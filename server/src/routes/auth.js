const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { generateAccessToken, generateRefreshToken, generateResetToken, setRefreshCookie, clearRefreshCookie } = require('../utils/tokens');
const { writeAuditLog } = require('../utils/auditLog');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email and password required' } });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    if (user.status === 'inactive' || user.status === 'suspended') {
      return res.status(401).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' } });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      await writeAuditLog({ actorId: user.id, actorRole: user.role, actionType: 'user.login_failed', entityType: 'user', entityId: user.id, req });
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    // BR-01: Set active + first_login_at on first login
    const updates = { last_login_at: new Date().toISOString() };
    if (user.status === 'pending_first_login') {
      updates.first_login_at = new Date().toISOString();
      updates.status = 'active';
    }
    await supabase.from('users').update(updates).eq('id', user.id);

    const refreshToken = generateRefreshToken();
    await supabase.from('refresh_tokens').insert({ user_id: user.id, token: refreshToken, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });

    const accessToken = generateAccessToken({ ...user, ...updates });
    setRefreshCookie(res, refreshToken);

    await writeAuditLog({ actorId: user.id, actorRole: user.role, actionType: user.status === 'pending_first_login' ? 'user.first_login' : 'user.login', entityType: 'user', entityId: user.id, req });

    res.json({
      access_token: accessToken,
      user: { id: user.id, role: user.role, name: user.name, email: user.email, org_id: user.org_id, status: updates.status || user.status, photo_url: user.photo_url },
    });
  } catch (err) { next(err); }
});

// ── POST /auth/refresh ───────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ error: { code: 'MISSING_REFRESH_TOKEN', message: 'Refresh token required' } });

    // BR-02: Single-use rotation
    const { data: record, error } = await supabase
      .from('refresh_tokens')
      .select('*, users(*)')
      .eq('token', token)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !record) return res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' } });

    // Invalidate old token
    await supabase.from('refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', record.id);

    // Issue new tokens
    const newRefreshToken = generateRefreshToken();
    await supabase.from('refresh_tokens').insert({ user_id: record.user_id, token: newRefreshToken, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });

    const accessToken = generateAccessToken(record.users);
    setRefreshCookie(res, newRefreshToken);

    res.json({ access_token: accessToken });
  } catch (err) { next(err); }
});

// ── POST /auth/logout ────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token;
    if (token) {
      await supabase.from('refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('token', token).eq('user_id', req.user.id);
    }
    clearRefreshCookie(res);
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'user.logout', entityType: 'user', entityId: req.user.id, req });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /auth/forgot-password ───────────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    // Always return 200 for security
    if (!email) return res.json({ success: true });

    const { data: user } = await supabase.from('users').select('id, email').eq('email', email.toLowerCase()).is('deleted_at', null).single();
    if (!user) return res.json({ success: true }); // Don't reveal email existence

    const plainToken = generateResetToken();
    const tokenHash = await bcrypt.hash(plainToken, 12);
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await supabase.from('users').update({ password_reset_token: tokenHash, password_reset_expires: expires }).eq('id', user.id);
    await writeAuditLog({ actorId: user.id, actorRole: 'UNKNOWN', actionType: 'user.password_reset_requested', entityType: 'user', entityId: user.id, req });

    // TODO: Send email with plainToken via email service
    console.log(`[DEV] Password reset token for ${email}: ${plainToken}`);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /auth/reset-password ────────────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Token and password required' } });

    // Password policy: 8+ chars, 1 upper, 1 lower, 1 digit
    const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!pwRegex.test(password)) {
      return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be 8+ chars with uppercase, lowercase, and digit' } });
    }

    const { data: users } = await supabase.from('users').select('id, password_reset_token, password_reset_expires, role').gt('password_reset_expires', new Date().toISOString()).is('deleted_at', null);

    let matchedUser = null;
    for (const u of users || []) {
      if (u.password_reset_token && await bcrypt.compare(token, u.password_reset_token)) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) return res.status(400).json({ error: { code: 'INVALID_RESET_TOKEN', message: 'Invalid or expired reset token' } });

    const hash = await bcrypt.hash(password, 12);
    await supabase.from('users').update({ password_hash: hash, password_reset_token: null, password_reset_expires: null, status: 'active' }).eq('id', matchedUser.id);
    await writeAuditLog({ actorId: matchedUser.id, actorRole: matchedUser.role, actionType: 'user.password_changed', entityType: 'user', entityId: matchedUser.id, req });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, role, email, name, display_name, photo_url, designation, department, org_id, status, first_login_at, last_login_at, mini_sa_permissions')
      .eq('id', req.user.id)
      .is('deleted_at', null)
      .single();
    res.json({ user });
  } catch (err) { next(err); }
});

module.exports = router;
