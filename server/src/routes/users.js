const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();
router.use(authenticate);

// Helper: generate temp password
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── GET /users ───────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    // ORG_ADMIN can only list PARTICIPANT users within their own org
    const isOrgAdmin = req.user.role === ROLES.ORG_ADMIN;
    const isPrivileged = [ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role);
    if (!isPrivileged && !isOrgAdmin) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }

    const { role, org_id, status, search, page = 1, limit = 20 } = req.query;
    let query = supabase.from('users').select('id,role,email,name,display_name,photo_url,designation,department,org_id,status,created_at', { count: 'exact' }).is('deleted_at', null);

    if (isOrgAdmin) {
      // Restrict to their org's participants only
      query = query.eq('org_id', req.user.org_id).eq('role', ROLES.PARTICIPANT);
    } else {
      if (role) query = query.eq('role', role);
      if (org_id) query = query.eq('org_id', org_id);
      // Mini SA org scope
      if (req.user.role === ROLES.MINI_SUPER_ADMIN) {
        const scope = req.user.mini_sa_permissions?.org_scope;
        if (scope && scope !== 'all') query = query.in('org_id', scope);
      }
    }

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
});

// ── POST /users ──────────────────────────────────────────────────────────────
router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN, ROLES.ORG_ADMIN), async (req, res, next) => {
  try {
    const { role, email, name, org_id, designation, department, employee_id, phone, manager_name } = req.body;

    // ORG_ADMIN restrictions
    if (req.user.role === ROLES.ORG_ADMIN) {
      if (role !== ROLES.PARTICIPANT) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Org Admin can only create Participants' } });
      const { data: org } = await supabase.from('organizations').select('participant_creation_by_org_admin').eq('id', req.user.org_id).single();
      if (!org?.participant_creation_by_org_admin) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Participant creation not enabled for this org' } });
    }

    if (!email || !name || !role) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'email, name, and role are required' } });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 12);

    const newUser = {
      id: uuidv4(),
      role, email: email.toLowerCase(), name,
      password_hash: hash,
      display_name: name,
      org_id: org_id || req.user.org_id || null,
      designation, department, employee_id, phone, manager_name,
      status: 'pending_first_login',
      email_verified: false,
      created_by: req.user.id,
    };

    const { data, error } = await supabase.from('users').insert(newUser).select('id,role,email,name,org_id,status').single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: { code: 'DUPLICATE_EMAIL', message: 'Email already in use' } });
      throw error;
    }

    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'user.created', entityType: 'user', entityId: data.id, afterState: { role, email, org_id }, req });

    // TODO: Send welcome email with tempPassword
    res.status(201).json({ data, temp_password: process.env.NODE_ENV !== 'production' ? tempPassword : undefined });
  } catch (err) { next(err); }
});

// ── GET /users/:id ───────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const isSelf = req.user.id === id;
    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role);
    const isOrgAdmin = req.user.role === ROLES.ORG_ADMIN;

    let query = supabase.from('users').select('id,role,email,name,display_name,photo_url,designation,department,employee_id,org_id,status,first_login_at,last_login_at,created_at').eq('id', id).is('deleted_at', null);

    if (!isSelf && !isAdmin && !isOrgAdmin) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });

    // ORG_ADMIN can only view users in own org
    if (isOrgAdmin) query = query.eq('org_id', req.user.org_id);

    const { data, error } = await query.single();
    if (error || !data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json({ data });
  } catch (err) { next(err); }
});

// ── PATCH /users/:id ─────────────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const isSelf = req.user.id === id;
    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role);

    if (!isSelf && !isAdmin) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });

    const allowedForSelf = ['name', 'display_name', 'photo_url', 'designation', 'department', 'phone'];
    const updates = isSelf && !isAdmin
      ? Object.fromEntries(Object.entries(req.body).filter(([k]) => allowedForSelf.includes(k)))
      : req.body;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No valid fields to update' } });

    delete updates.password_hash; delete updates.role; delete updates.id;
    updates.updated_at = new Date().toISOString();

    const { data: before } = await supabase.from('users').select('*').eq('id', id).single();
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;

    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'user.updated', entityType: 'user', entityId: id, beforeState: before, afterState: updates, req });
    res.json({ data });
  } catch (err) { next(err); }
});

// ── POST /users/:id/reset-password (Super Admin / Mini Super Admin only) ─────
router.post('/:id/reset-password', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'new_password is required' } });
    if (new_password.length < 8) return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } });

    const { data: target, error } = await supabase.from('users').select('id, role').eq('id', id).is('deleted_at', null).single();
    if (error || !target) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });

    // Mini Super Admin cannot reset another Super Admin's password
    if (req.user.role === ROLES.MINI_SUPER_ADMIN && target.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot reset a Super Admin password' } });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await supabase.from('users').update({ password_hash: hash, updated_at: new Date().toISOString() }).eq('id', id);
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'user.password_reset_by_admin', entityType: 'user', entityId: id, req });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { next(err); }
});

// ── POST /users/:id/deactivate ───────────────────────────────────────────────
router.post('/:id/deactivate', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    await supabase.from('users').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', id);
    // Revoke all refresh tokens
    await supabase.from('refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('user_id', id).is('revoked_at', null);
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'user.deactivated', entityType: 'user', entityId: id, req });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /users/:id/reactivate ───────────────────────────────────────────────
router.post('/:id/reactivate', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    await supabase.from('users').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', id);
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'user.reactivated', entityType: 'user', entityId: id, req });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
