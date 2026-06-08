// ── ELOP API — Vercel Serverless ─────────────────────────────────────────────
// Zero external deps: pure Node.js builtins + Supabase REST via HTTPS
'use strict';
const https  = require('https');
const crypto = require('crypto');
const url    = require('url');

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || 'elop_jwt_secret_change_in_production_min32chars';
const BYPASS_PWD = 'ElopTest@2026'; // remove before go-live

// ─────────────────────────────────────────────────────────────────────────────
// Supabase REST helper
// ─────────────────────────────────────────────────────────────────────────────
function sb(method, path, body, extra = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(SB_URL + path);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...extra,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw || 'null'), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: raw, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Count rows via a dedicated count query
async function sbCount(table, filter = '') {
  const r = await sb('HEAD', `/rest/v1/${table}?${filter}`, null, { Prefer: 'count=exact' });
  const cr = r.headers['content-range'] || '';
  const match = cr.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT helpers (HS256, pure crypto)
// ─────────────────────────────────────────────────────────────────────────────
function b64u(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
function signJWT(payload) {
  const h = b64u({ alg: 'HS256', typ: 'JWT' });
  const p = b64u(payload);
  const s = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
function verifyJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const [h, p, s] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  if (s !== expected) throw new Error('invalid signature');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired');
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}
function parseQuery(reqUrl) {
  return Object.fromEntries(new URL('http://x' + reqUrl).searchParams);
}
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function setCORS(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ─────────────────────────────────────────────────────────────────────────────
// Vercel handler
// ─────────────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCORS(res, req.headers.origin);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const { pathname } = url.parse(req.url);
  const qs = parseQuery(req.url);
  const method = req.method;

  // ── Health ──────────────────────────────────────────────────────────────────
  if (pathname === '/health' || pathname === '/api/v1/health') {
    return json(res, 200, { status: 'ok', version: '1.0.0', env: { sb: !!SB_URL, key: !!SB_KEY } });
  }

  // ── POST /api/v1/auth/login ─────────────────────────────────────────────────
  if (pathname === '/api/v1/auth/login' && method === 'POST') {
    try {
      const { email, password } = await parseBody(req);
      if (!email || !password) return json(res, 400, { error: { code: 'INVALID_INPUT', message: 'Email and password required' } });

      const r = await sb('GET', `/rest/v1/users?email=eq.${encodeURIComponent(email.toLowerCase().trim())}&deleted_at=is.null&limit=1`);
      const user = (r.body || [])[0];
      if (!user) return json(res, 401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      if (user.status === 'inactive' || user.status === 'suspended') return json(res, 401, { error: { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' } });

      // Password check — bypass or bcrypt
      if (password !== BYPASS_PWD) {
        try {
          const bcrypt = require('bcryptjs');
          const ok = await bcrypt.compare(password, user.password_hash || '');
          if (!ok) return json(res, 401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        } catch {
          return json(res, 401, { error: { code: 'INVALID_CREDENTIALS', message: 'Use bypass password for testing' } });
        }
      }

      const now = new Date().toISOString();
      const updates = { last_login_at: now, ...(user.status === 'pending_first_login' ? { first_login_at: now, status: 'active' } : {}) };
      await sb('PATCH', `/rest/v1/users?id=eq.${user.id}`, updates);

      const refreshToken = crypto.randomBytes(64).toString('hex');
      await sb('POST', '/rest/v1/refresh_tokens', { user_id: user.id, token: refreshToken, expires_at: new Date(Date.now() + 30*24*3600000).toISOString() });

      const accessToken = signJWT({ sub: user.id, role: user.role, org_id: user.org_id || null, exp: Math.floor(Date.now()/1000) + 900 });
      res.setHeader('Set-Cookie', `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${30*24*3600}; Path=/`);
      return json(res, 200, {
        access_token: accessToken,
        user: { id: user.id, role: user.role, name: user.name, email: user.email, org_id: user.org_id, status: updates.status || user.status, photo_url: user.photo_url },
      });
    } catch (err) { return json(res, 500, { error: { code: 'INTERNAL_ERROR', message: err.message } }); }
  }

  // ── POST /api/v1/auth/refresh ───────────────────────────────────────────────
  if (pathname === '/api/v1/auth/refresh' && method === 'POST') {
    try {
      const cookies = req.headers.cookie || '';
      const match = cookies.match(/refresh_token=([^;]+)/);
      if (!match) return json(res, 401, { error: { code: 'MISSING_REFRESH_TOKEN' } });
      const r = await sb('GET', `/rest/v1/refresh_tokens?token=eq.${match[1]}&revoked_at=is.null&expires_at=gt.${new Date().toISOString()}&select=*,users(*)&limit=1`);
      const record = (r.body || [])[0];
      if (!record) return json(res, 401, { error: { code: 'INVALID_REFRESH_TOKEN' } });
      await sb('PATCH', `/rest/v1/refresh_tokens?id=eq.${record.id}`, { revoked_at: new Date().toISOString() });
      const newToken = crypto.randomBytes(64).toString('hex');
      await sb('POST', '/rest/v1/refresh_tokens', { user_id: record.user_id, token: newToken, expires_at: new Date(Date.now() + 30*24*3600000).toISOString() });
      res.setHeader('Set-Cookie', `refresh_token=${newToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${30*24*3600}; Path=/`);
      const u = record.users;
      return json(res, 200, { access_token: signJWT({ sub: u.id, role: u.role, org_id: u.org_id || null, exp: Math.floor(Date.now()/1000) + 900 }) });
    } catch (err) { return json(res, 500, { error: { code: 'INTERNAL_ERROR', message: err.message } }); }
  }

  // ── POST /api/v1/auth/logout ────────────────────────────────────────────────
  if (pathname === '/api/v1/auth/logout' && method === 'POST') {
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/refresh_token=([^;]+)/);
    if (match) await sb('PATCH', `/rest/v1/refresh_tokens?token=eq.${match[1]}`, { revoked_at: new Date().toISOString() });
    res.setHeader('Set-Cookie', 'refresh_token=; HttpOnly; Secure; Max-Age=0; Path=/');
    return json(res, 200, { success: true });
  }

  // ── Auth guard for all routes below ────────────────────────────────────────
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return json(res, 401, { error: { code: 'UNAUTHORIZED', message: 'Login required' } });
  let currentUser;
  try { currentUser = verifyJWT(authHeader.slice(7)); }
  catch { return json(res, 401, { error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } }); }

  // ── GET /api/v1/auth/me ─────────────────────────────────────────────────────
  if (pathname === '/api/v1/auth/me' && method === 'GET') {
    const r = await sb('GET', `/rest/v1/users?id=eq.${currentUser.sub}&deleted_at=is.null&limit=1&select=id,role,email,name,display_name,photo_url,designation,department,org_id,status,first_login_at,last_login_at,mini_sa_permissions`);
    return json(res, 200, { user: (r.body || [])[0] || null });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ORGANIZATIONS
  // ══════════════════════════════════════════════════════════════════════════════
  if (pathname === '/api/v1/organizations') {
    if (method === 'GET') {
      try {
        let filter = 'deleted_at=is.null&order=created_at.desc';
        if (qs.status) filter += `&status=eq.${qs.status}`;
        if (qs.search) filter += `&or=(name.ilike.*${encodeURIComponent(qs.search)}*,display_name.ilike.*${encodeURIComponent(qs.search)}*)`;
        const limit = parseInt(qs.limit || '50');
        const offset = parseInt(qs.offset || '0');
        filter += `&limit=${limit}&offset=${offset}`;

        const [dataRes, total] = await Promise.all([
          sb('GET', `/rest/v1/organizations?${filter}`),
          sbCount('organizations', `deleted_at=is.null${qs.status ? `&status=eq.${qs.status}` : ''}`),
        ]);
        return json(res, 200, { data: dataRes.body || [], meta: { total, limit, offset } });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
    if (method === 'POST') {
      try {
        const body = await parseBody(req);
        const { name, display_name, industry, primary_contact_name, primary_contact_email, primary_contact_phone } = body;
        if (!name || !display_name) return json(res, 400, { error: { message: 'name and display_name are required' } });
        const slug = (body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30)) + '-' + crypto.randomBytes(2).toString('hex');
        const r = await sb('POST', '/rest/v1/organizations', { id: crypto.randomUUID(), name, display_name, slug, industry, primary_contact_name, primary_contact_email, primary_contact_phone, status: 'active', created_by: currentUser.sub });
        return json(res, 201, { data: (r.body || [])[0] || r.body });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
  }
  const orgMatch = pathname.match(/^\/api\/v1\/organizations\/([^/]+)$/);
  if (orgMatch) {
    const orgId = orgMatch[1];
    if (method === 'GET') {
      const r = await sb('GET', `/rest/v1/organizations?id=eq.${orgId}&deleted_at=is.null&limit=1`);
      const org = (r.body || [])[0];
      if (!org) return json(res, 404, { error: { message: 'Organization not found' } });
      return json(res, 200, { data: org });
    }
    if (method === 'PATCH') {
      const body = await parseBody(req);
      const r = await sb('PATCH', `/rest/v1/organizations?id=eq.${orgId}`, { ...body, updated_at: new Date().toISOString() });
      return json(res, 200, { data: (r.body || [])[0] || r.body });
    }
    if (method === 'DELETE') {
      await sb('PATCH', `/rest/v1/organizations?id=eq.${orgId}`, { deleted_at: new Date().toISOString() });
      return json(res, 200, { success: true });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // USERS
  // ══════════════════════════════════════════════════════════════════════════════
  if (pathname === '/api/v1/users') {
    if (method === 'GET') {
      try {
        let filter = 'deleted_at=is.null&order=created_at.desc&select=id,name,email,role,status,org_id,designation,department,last_login_at,created_at';
        if (qs.role) filter += `&role=eq.${qs.role}`;
        if (qs.org_id) filter += `&org_id=eq.${qs.org_id}`;
        if (qs.search) filter += `&or=(name.ilike.*${encodeURIComponent(qs.search)}*,email.ilike.*${encodeURIComponent(qs.search)}*)`;
        const limit = parseInt(qs.limit || '50');
        const offset = parseInt(qs.offset || '0');
        filter += `&limit=${limit}&offset=${offset}`;

        let countFilter = 'deleted_at=is.null';
        if (qs.role) countFilter += `&role=eq.${qs.role}`;

        const [dataRes, total] = await Promise.all([
          sb('GET', `/rest/v1/users?${filter}`),
          sbCount('users', countFilter),
        ]);
        return json(res, 200, { data: dataRes.body || [], meta: { total, limit, offset } });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
    if (method === 'POST') {
      try {
        const body = await parseBody(req);
        const { name, email, role, org_id, designation, department, employee_id, phone, manager_name } = body;
        if (!name || !email || !role) return json(res, 400, { error: { message: 'name, email, and role are required' } });
        const tempPwd = 'Welcome@' + crypto.randomBytes(3).toString('hex').toUpperCase();
        let password_hash = tempPwd; // fallback plain (never used — reset on first login)
        try { const b = require('bcryptjs'); password_hash = await b.hash(tempPwd, 12); } catch {}
        const r = await sb('POST', '/rest/v1/users', {
          id: crypto.randomUUID(), name, email: email.toLowerCase(), role, org_id, designation, department, employee_id, phone, manager_name,
          password_hash, status: 'pending_first_login', created_by: currentUser.sub,
        });
        if (r.status >= 400) return json(res, r.status, { error: { message: JSON.stringify(r.body) } });
        return json(res, 201, { data: (r.body || [])[0] || r.body, temp_password: tempPwd });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
  }
  const userMatch = pathname.match(/^\/api\/v1\/users\/([^/]+)$/);
  if (userMatch) {
    const uid = userMatch[1];
    if (method === 'GET') {
      const r = await sb('GET', `/rest/v1/users?id=eq.${uid}&deleted_at=is.null&limit=1`);
      const u = (r.body || [])[0];
      if (!u) return json(res, 404, { error: { message: 'User not found' } });
      return json(res, 200, { data: u });
    }
    if (method === 'PATCH') {
      const body = await parseBody(req);
      const allowed = ['name','display_name','designation','department','status','role','org_id','photo_url','phone','manager_name','employee_id'];
      const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
      updates.updated_at = new Date().toISOString();
      const r = await sb('PATCH', `/rest/v1/users?id=eq.${uid}`, updates);
      return json(res, 200, { data: (r.body || [])[0] || r.body });
    }
    if (method === 'DELETE') {
      await sb('PATCH', `/rest/v1/users?id=eq.${uid}`, { deleted_at: new Date().toISOString() });
      return json(res, 200, { success: true });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // COHORTS
  // ══════════════════════════════════════════════════════════════════════════════
  if (pathname === '/api/v1/cohorts') {
    if (method === 'GET') {
      try {
        let filter = 'deleted_at=is.null&order=created_at.desc&select=*,organizations(id,name,display_name,slug)';
        if (qs.status) filter += `&status=eq.${qs.status}`;
        if (qs.org_id) filter += `&org_id=eq.${qs.org_id}`;
        if (qs.search) filter += `&name=ilike.*${encodeURIComponent(qs.search)}*`;
        const limit = parseInt(qs.limit || '50');
        const offset = parseInt(qs.offset || '0');
        filter += `&limit=${limit}&offset=${offset}`;

        let countFilter = 'deleted_at=is.null';
        if (qs.status) countFilter += `&status=eq.${qs.status}`;

        const [dataRes, total] = await Promise.all([
          sb('GET', `/rest/v1/cohorts?${filter}`),
          sbCount('cohorts', countFilter),
        ]);
        const cohorts = dataRes.body || [];

        // Fetch enrollment counts for all cohorts in one query
        if (cohorts.length > 0) {
          const ids = cohorts.map(c => c.id);
          const enrollFilter = `cohort_id=in.(${ids.join(',')})&status=eq.active&select=cohort_id`;
          const enrRes = await sb('GET', `/rest/v1/enrollments?${enrollFilter}`);
          const enrMap = {};
          (enrRes.body || []).forEach(e => { enrMap[e.cohort_id] = (enrMap[e.cohort_id] || 0) + 1; });
          cohorts.forEach(c => { c.enrollment_count = enrMap[c.id] || 0; });
        }

        return json(res, 200, { data: cohorts, meta: { total, limit, offset } });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
    if (method === 'POST') {
      try {
        const body = await parseBody(req);
        const { name, org_id, program_type, start_date, end_date, enrollment_capacity, internal_notes, pre_assessment_open, pre_assessment_close, content_access_start, content_access_end } = body;
        if (!name || !org_id) return json(res, 400, { error: { message: 'name and org_id are required' } });

        // Generate cohort_code: [ORG_SLUG_4]-[PROG_3]-[YYYYMM]-[RAND4]
        const orgRes = await sb('GET', `/rest/v1/organizations?id=eq.${org_id}&select=slug&limit=1`);
        const orgSlug = ((orgRes.body || [])[0]?.slug || 'ORG').slice(0, 4).toUpperCase();
        const progCode = (program_type || 'PRG').slice(0, 3).toUpperCase();
        const ym = new Date().toISOString().slice(0, 7).replace('-', '');
        const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
        const cohort_code = `${orgSlug}-${progCode}-${ym}-${rand}`;

        const r = await sb('POST', '/rest/v1/cohorts', {
          id: crypto.randomUUID(), name, org_id, program_type, cohort_code, start_date, end_date,
          enrollment_capacity, internal_notes, pre_assessment_open, pre_assessment_close,
          content_access_start, content_access_end, status: 'draft', created_by: currentUser.sub,
        });
        if (r.status >= 400) return json(res, r.status, { error: { message: JSON.stringify(r.body) } });
        return json(res, 201, { data: (r.body || [])[0] || r.body });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
  }

  const cohortMatch = pathname.match(/^\/api\/v1\/cohorts\/([^/]+)$/);
  if (cohortMatch) {
    const cid = cohortMatch[1];
    if (method === 'GET') {
      try {
        const [cRes, enrRes] = await Promise.all([
          sb('GET', `/rest/v1/cohorts?id=eq.${cid}&deleted_at=is.null&select=*,organizations(id,name,display_name,slug)&limit=1`),
          sb('GET', `/rest/v1/enrollments?cohort_id=eq.${cid}&status=eq.active&select=cohort_id`),
        ]);
        const cohort = (cRes.body || [])[0];
        if (!cohort) return json(res, 404, { error: { message: 'Cohort not found' } });
        cohort.enrollment_count = (enrRes.body || []).length;
        return json(res, 200, { data: cohort });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
    if (method === 'PATCH') {
      try {
        const body = await parseBody(req);
        // Status transition guard
        if (body.status) {
          const current = await sb('GET', `/rest/v1/cohorts?id=eq.${cid}&select=status&limit=1`);
          const cur = (current.body || [])[0]?.status;
          const allowed = { draft: ['active'], active: ['completed'], completed: ['archived'] };
          if (!allowed[cur]?.includes(body.status)) {
            return json(res, 400, { error: { message: `Cannot transition from ${cur} to ${body.status}` } });
          }
        }
        const r = await sb('PATCH', `/rest/v1/cohorts?id=eq.${cid}`, { ...body, updated_at: new Date().toISOString() });
        return json(res, 200, { data: (r.body || [])[0] || r.body });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
    if (method === 'DELETE') {
      await sb('PATCH', `/rest/v1/cohorts?id=eq.${cid}`, { deleted_at: new Date().toISOString() });
      return json(res, 200, { success: true });
    }
  }

  // ── Enrollments ─────────────────────────────────────────────────────────────
  const enrollMatch = pathname.match(/^\/api\/v1\/cohorts\/([^/]+)\/enrollments$/);
  if (enrollMatch) {
    const cid = enrollMatch[1];
    if (method === 'GET') {
      const r = await sb('GET', `/rest/v1/enrollments?cohort_id=eq.${cid}&select=*,users(id,name,email,role,designation,department,photo_url)&order=enrolled_at.desc`);
      return json(res, 200, { data: r.body || [] });
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const ids = body.participant_ids || body.user_ids || [];
      if (!ids.length) return json(res, 400, { error: { message: 'participant_ids required' } });
      const rows = ids.map(pid => ({ id: crypto.randomUUID(), cohort_id: cid, participant_id: pid, enrolled_by: currentUser.sub, enrolled_at: new Date().toISOString(), status: 'active' }));
      const r = await sb('POST', '/rest/v1/enrollments', rows);
      return json(res, 201, { data: r.body || [] });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ASSESSMENTS
  // ══════════════════════════════════════════════════════════════════════════════
  if (pathname === '/api/v1/assessments') {
    if (method === 'GET') {
      let filter = 'deleted_at=is.null&order=created_at.desc';
      if (qs.library_status) filter += `&library_status=eq.${qs.library_status}`;
      if (qs.assessment_type) filter += `&assessment_type=eq.${qs.assessment_type}`;
      const limit = parseInt(qs.limit || '50');
      filter += `&limit=${limit}`;
      const [dataRes, total] = await Promise.all([
        sb('GET', `/rest/v1/assessments?${filter}`),
        sbCount('assessments', 'deleted_at=is.null'),
      ]);
      return json(res, 200, { data: dataRes.body || [], meta: { total } });
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const r = await sb('POST', '/rest/v1/assessments', { id: crypto.randomUUID(), ...body, library_status: 'draft', created_by: currentUser.sub });
      if (r.status >= 400) return json(res, r.status, { error: { message: JSON.stringify(r.body) } });
      return json(res, 201, { data: (r.body || [])[0] || r.body });
    }
  }
  const asmtMatch = pathname.match(/^\/api\/v1\/assessments\/([^/]+)$/);
  if (asmtMatch) {
    const aid = asmtMatch[1];
    if (method === 'GET') {
      const r = await sb('GET', `/rest/v1/assessments?id=eq.${aid}&deleted_at=is.null&limit=1`);
      const a = (r.body || [])[0];
      if (!a) return json(res, 404, { error: { message: 'Assessment not found' } });
      return json(res, 200, { data: a });
    }
    if (method === 'PATCH') {
      const body = await parseBody(req);
      const r = await sb('PATCH', `/rest/v1/assessments?id=eq.${aid}`, { ...body, updated_at: new Date().toISOString() });
      return json(res, 200, { data: (r.body || [])[0] || r.body });
    }
    if (method === 'DELETE') {
      await sb('PATCH', `/rest/v1/assessments?id=eq.${aid}`, { deleted_at: new Date().toISOString() });
      return json(res, 200, { success: true });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // CONTENT ITEMS
  // ══════════════════════════════════════════════════════════════════════════════
  if (pathname === '/api/v1/content') {
    if (method === 'GET') {
      let filter = 'deleted_at=is.null&order=created_at.desc';
      if (qs.content_type) filter += `&content_type=eq.${qs.content_type}`;
      if (qs.library_status) filter += `&library_status=eq.${qs.library_status}`;
      if (qs.search) filter += `&title=ilike.*${encodeURIComponent(qs.search)}*`;
      filter += `&limit=${parseInt(qs.limit || '50')}`;
      const [dataRes, total] = await Promise.all([
        sb('GET', `/rest/v1/content_items?${filter}`),
        sbCount('content_items', 'deleted_at=is.null'),
      ]);
      return json(res, 200, { data: dataRes.body || [], meta: { total } });
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const r = await sb('POST', '/rest/v1/content_items', { id: crypto.randomUUID(), ...body, version: 1, library_status: 'published', created_by: currentUser.sub });
      if (r.status >= 400) return json(res, r.status, { error: { message: JSON.stringify(r.body) } });
      return json(res, 201, { data: (r.body || [])[0] || r.body });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ANNOUNCEMENTS
  // ══════════════════════════════════════════════════════════════════════════════
  if (pathname === '/api/v1/announcements') {
    if (method === 'GET') {
      let filter = 'deleted_at=is.null&order=created_at.desc';
      if (qs.scope_type) filter += `&scope_type=eq.${qs.scope_type}`;
      filter += `&limit=${parseInt(qs.limit || '20')}`;
      const r = await sb('GET', `/rest/v1/announcements?${filter}`);
      return json(res, 200, { data: r.body || [] });
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const r = await sb('POST', '/rest/v1/announcements', { id: crypto.randomUUID(), ...body, created_by: currentUser.sub });
      return json(res, 201, { data: (r.body || [])[0] || r.body });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ADMIN DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════════
  if (pathname === '/api/v1/admin/dashboard' && method === 'GET') {
    try {
      const sevenDaysLater = new Date(Date.now() + 7*86400000).toISOString().slice(0, 10);
      const [orgs, activeCohorts, allPart, activePart, expiring] = await Promise.all([
        sb('GET', '/rest/v1/organizations?deleted_at=is.null&select=id'),
        sb('GET', '/rest/v1/cohorts?status=eq.active&deleted_at=is.null&select=id'),
        sb('GET', '/rest/v1/users?role=eq.PARTICIPANT&deleted_at=is.null&select=id'),
        sb('GET', '/rest/v1/users?role=eq.PARTICIPANT&status=eq.active&deleted_at=is.null&select=id'),
        sb('GET', `/rest/v1/cohorts?status=eq.active&deleted_at=is.null&end_date=lte.${sevenDaysLater}&select=id,name,end_date`),
      ]);
      return json(res, 200, {
        data: {
          kpi: {
            active_organizations: (orgs.body || []).length,
            active_cohorts: (activeCohorts.body || []).length,
            participants: { total: (allPart.body || []).length, by_status: { active: (activePart.body || []).length } },
            assessments_pending_review: 0,
            platform_alerts: (expiring.body || []).length,
          },
          alerts_detail: { expiring_cohorts: expiring.body || [], inactive_participants: 0 },
        }
      });
    } catch (err) { return json(res, 500, { error: { message: err.message } }); }
  }

  // ── Cohort Health Board ──────────────────────────────────────────────────────
  if (pathname === '/api/v1/admin/cohort-health-board' && method === 'GET') {
    try {
      const cohortsRes = await sb('GET', '/rest/v1/cohorts?deleted_at=is.null&status=neq.archived&order=health_label.asc.nullslast,health_score.asc&select=*,organizations(id,name,display_name)&limit=50');
      const cohorts = cohortsRes.body || [];
      // Attach enrollment counts
      if (cohorts.length > 0) {
        const ids = cohorts.map(c => c.id);
        const enrRes = await sb('GET', `/rest/v1/enrollments?cohort_id=in.(${ids.join(',')})&status=eq.active&select=cohort_id`);
        const enrMap = {};
        (enrRes.body || []).forEach(e => { enrMap[e.cohort_id] = (enrMap[e.cohort_id] || 0) + 1; });
        cohorts.forEach(c => { c.enrollment_count = enrMap[c.id] || 0; });
      }
      return json(res, 200, { data: cohorts });
    } catch (err) { return json(res, 500, { error: { message: err.message } }); }
  }

  // ── Activity Feed ────────────────────────────────────────────────────────────
  if (pathname === '/api/v1/admin/activity-feed' && method === 'GET') {
    const r = await sb('GET', '/rest/v1/audit_logs?order=created_at.desc&limit=30');
    return json(res, 200, { data: r.body || [] });
  }

  // ── Analytics ────────────────────────────────────────────────────────────────
  const analyticsMatch = pathname.match(/^\/api\/v1\/analytics\/cohort\/([^/]+)$/);
  if (analyticsMatch && method === 'GET') {
    const cid = analyticsMatch[1];
    const [cRes, enrRes] = await Promise.all([
      sb('GET', `/rest/v1/cohorts?id=eq.${cid}&select=*,organizations(name,display_name)&limit=1`),
      sb('GET', `/rest/v1/enrollments?cohort_id=eq.${cid}&select=status`),
    ]);
    const cohort = (cRes.body || [])[0];
    const enrollments = enrRes.body || [];
    return json(res, 200, {
      data: {
        cohort,
        enrollment_count: enrollments.filter(e => e.status === 'active').length,
        total_enrolled: enrollments.length,
        completion_rate: 0,
        health_score: cohort?.health_score || 0,
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // COHORT ACTIONS: launch / complete
  // ══════════════════════════════════════════════════════════════════════════════
  const cohortActionMatch = pathname.match(/^\/api\/v1\/cohorts\/([^/]+)\/(launch|complete)$/);
  if (cohortActionMatch && method === 'POST') {
    const [, cid, action] = cohortActionMatch;
    try {
      if (action === 'launch') {
        const cohortRes = await sb('GET', `/rest/v1/cohorts?id=eq.${cid}&select=status&limit=1`);
        const cohort = (cohortRes.body || [])[0];
        if (!cohort) return json(res, 404, { error: { message: 'Cohort not found' } });
        if (cohort.status !== 'draft') return json(res, 400, { error: { message: 'Only draft cohorts can be launched' } });
        const enrCount = await sbCount('enrollments', `cohort_id=eq.${cid}&status=eq.active`);
        if (!enrCount) return json(res, 400, { error: { message: 'Cohort must have at least 1 enrollment before launch' } });
        await sb('PATCH', `/rest/v1/cohorts?id=eq.${cid}`, { status: 'active', updated_at: new Date().toISOString() });
        return json(res, 200, { success: true, message: 'Cohort launched successfully' });
      }
      if (action === 'complete') {
        await sb('PATCH', `/rest/v1/cohorts?id=eq.${cid}`, { status: 'completed', updated_at: new Date().toISOString() });
        return json(res, 200, { success: true });
      }
    } catch (err) { return json(res, 500, { error: { message: err.message } }); }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // JOURNEY ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════════

  // ── GET/PATCH /cohorts/:id/journey ────────────────────────────────────────────
  const journeyRouteMatch = pathname.match(/^\/api\/v1\/cohorts\/([^/]+)\/journey$/);
  if (journeyRouteMatch) {
    const cid = journeyRouteMatch[1];
    if (method === 'GET') {
      try {
        const cohortRes = await sb('GET', `/rest/v1/cohorts?id=eq.${cid}&deleted_at=is.null&select=id,org_id&limit=1`);
        const cohort = (cohortRes.body || [])[0];
        if (!cohort) return json(res, 404, { error: { message: 'Cohort not found' } });
        if (currentUser.role === 'ORG_ADMIN' && cohort.org_id !== currentUser.org_id) {
          return json(res, 404, { error: { message: 'Cohort not found' } });
        }
        if (currentUser.role === 'PARTICIPANT') {
          const enrRes = await sb('GET', `/rest/v1/enrollments?cohort_id=eq.${cid}&participant_id=eq.${currentUser.sub}&status=eq.active&select=id&limit=1`);
          if (!(enrRes.body || []).length) return json(res, 404, { error: { message: 'Cohort not found' } });
        }
        const journeyRes = await sb('GET', `/rest/v1/cohort_journeys?cohort_id=eq.${cid}&is_active=eq.true&limit=1`);
        let journey = (journeyRes.body || [])[0];
        if (!journey && ['SUPER_ADMIN', 'MINI_SUPER_ADMIN'].includes(currentUser.role)) {
          const jId = crypto.randomUUID();
          const created = await sb('POST', '/rest/v1/cohort_journeys', {
            id: jId, cohort_id: cid, name: 'Learning Journey',
            is_active: true, created_by: currentUser.sub,
          });
          journey = (created.body || [])[0] || { id: jId, cohort_id: cid, name: 'Learning Journey', is_active: true };
        }
        if (!journey) return json(res, 404, { error: { message: 'No journey configured yet' } });
        let ivFilter = `journey_id=eq.${journey.id}&order=sequence_order.asc&select=*,content_items(id,title,content_type,file_url,external_url,estimated_minutes)`;
        if (currentUser.role === 'PARTICIPANT') ivFilter += '&status=eq.published';
        const ivRes = await sb('GET', `/rest/v1/journey_interventions?${ivFilter}`);
        return json(res, 200, { data: { ...journey, interventions: ivRes.body || [] } });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
    if (method === 'PATCH') {
      try {
        const body = await parseBody(req);
        const r = await sb('PATCH', `/rest/v1/cohort_journeys?cohort_id=eq.${cid}&is_active=eq.true`, {
          name: body.name, description: body.description, updated_at: new Date().toISOString(),
        });
        return json(res, 200, { data: (r.body || [])[0] || r.body });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
  }

  // ── PATCH /cohorts/:id/journey/interventions/reorder ─────────────────────────
  // MUST be before /:ivId to prevent "reorder" matching as a UUID param
  const reorderRouteMatch = pathname.match(/^\/api\/v1\/cohorts\/([^/]+)\/journey\/interventions\/reorder$/);
  if (reorderRouteMatch && method === 'PATCH') {
    const cid = reorderRouteMatch[1];
    try {
      const { order } = await parseBody(req);
      if (!Array.isArray(order)) return json(res, 400, { error: { message: 'order must be array' } });
      await Promise.all(order.map(({ id, sequence_order }) =>
        sb('PATCH', `/rest/v1/journey_interventions?id=eq.${id}&cohort_id=eq.${cid}`, {
          sequence_order, updated_at: new Date().toISOString(),
        })
      ));
      return json(res, 200, { success: true });
    } catch (err) { return json(res, 500, { error: { message: err.message } }); }
  }

  // ── POST /cohorts/:id/journey/interventions ────────────────────────────────────
  const ivListRouteMatch = pathname.match(/^\/api\/v1\/cohorts\/([^/]+)\/journey\/interventions$/);
  if (ivListRouteMatch && method === 'POST') {
    const cid = ivListRouteMatch[1];
    try {
      const body = await parseBody(req);
      const { title, intervention_type, sequence_order, description, facilitator_notes,
        scheduled_date, scheduled_time, duration_minutes, virtual_session_link,
        virtual_session_platform, content_item_id, release_at, access_until,
        is_mandatory, status } = body;
      if (!title || !intervention_type) return json(res, 400, { error: { message: 'title and intervention_type are required' } });
      const journeyRes = await sb('GET', `/rest/v1/cohort_journeys?cohort_id=eq.${cid}&is_active=eq.true&select=id&limit=1`);
      let journeyId = (journeyRes.body || [])[0]?.id;
      if (!journeyId) {
        journeyId = crypto.randomUUID();
        await sb('POST', '/rest/v1/cohort_journeys', {
          id: journeyId, cohort_id: cid, name: 'Learning Journey', is_active: true, created_by: currentUser.sub,
        });
      }
      let order = sequence_order;
      if (order === undefined || order === null) {
        order = await sbCount('journey_interventions', `journey_id=eq.${journeyId}`);
      }
      const r = await sb('POST', '/rest/v1/journey_interventions', {
        id: crypto.randomUUID(), journey_id: journeyId, cohort_id: cid,
        title, intervention_type, sequence_order: order,
        description, facilitator_notes, scheduled_date, scheduled_time,
        duration_minutes, virtual_session_link, virtual_session_platform,
        content_item_id: content_item_id || null,
        release_at, access_until,
        is_mandatory: is_mandatory !== false,
        status: status || 'published',
      });
      if (r.status >= 400) return json(res, r.status, { error: { message: JSON.stringify(r.body) } });
      return json(res, 201, { data: (r.body || [])[0] || r.body });
    } catch (err) { return json(res, 500, { error: { message: err.message } }); }
  }

  // ── PATCH/DELETE /cohorts/:id/journey/interventions/:ivId ─────────────────────
  const ivRouteMatch = pathname.match(/^\/api\/v1\/cohorts\/([^/]+)\/journey\/interventions\/([^/]+)$/);
  if (ivRouteMatch) {
    const [, cid, ivId] = ivRouteMatch;
    if (method === 'PATCH') {
      try {
        const body = await parseBody(req);
        delete body.id; delete body.journey_id; delete body.cohort_id;
        const r = await sb('PATCH', `/rest/v1/journey_interventions?id=eq.${ivId}&cohort_id=eq.${cid}`, {
          ...body, updated_at: new Date().toISOString(),
        });
        return json(res, 200, { data: (r.body || [])[0] || r.body });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
    if (method === 'DELETE') {
      try {
        await sb('DELETE', `/rest/v1/journey_interventions?id=eq.${ivId}&cohort_id=eq.${cid}`);
        return json(res, 200, { success: true });
      } catch (err) { return json(res, 500, { error: { message: err.message } }); }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ORG ADMIN PORTAL
  // ══════════════════════════════════════════════════════════════════════════════

  if (pathname === '/api/v1/org-admin/cohorts' && method === 'GET') {
    if (currentUser.role !== 'ORG_ADMIN') return json(res, 403, { error: { code: 'FORBIDDEN', message: 'Org admin access only' } });
    try {
      const cohortsRes = await sb('GET', `/rest/v1/cohorts?org_id=eq.${currentUser.org_id}&deleted_at=is.null&status=in.(active,draft,completed)&order=created_at.desc&select=id,name,cohort_code,program_type,status,start_date,end_date,health_score,health_label,enrollment_capacity,created_at`);
      const cohorts = cohortsRes.body || [];
      if (cohorts.length > 0) {
        const ids = cohorts.map(c => c.id);
        const enrRes = await sb('GET', `/rest/v1/enrollments?cohort_id=in.(${ids.join(',')})&status=eq.active&select=cohort_id`);
        const enrMap = {};
        (enrRes.body || []).forEach(e => { enrMap[e.cohort_id] = (enrMap[e.cohort_id] || 0) + 1; });
        cohorts.forEach(c => { c.enrollment_count = enrMap[c.id] || 0; });
      }
      return json(res, 200, { data: cohorts });
    } catch (err) { return json(res, 500, { error: { message: err.message } }); }
  }

  const orgAdminParticipantsMatch = pathname.match(/^\/api\/v1\/org-admin\/cohorts\/([^/]+)\/participants$/);
  if (orgAdminParticipantsMatch && method === 'GET') {
    if (currentUser.role !== 'ORG_ADMIN') return json(res, 403, { error: { code: 'FORBIDDEN', message: 'Org admin access only' } });
    const cid = orgAdminParticipantsMatch[1];
    try {
      const cohortRes = await sb('GET', `/rest/v1/cohorts?id=eq.${cid}&org_id=eq.${currentUser.org_id}&select=id&limit=1`);
      if (!(cohortRes.body || []).length) return json(res, 404, { error: { message: 'Cohort not found' } });
      const r = await sb('GET', `/rest/v1/enrollments?cohort_id=eq.${cid}&status=neq.withdrawn&order=enrolled_at.asc&select=id,status,enrolled_at,users(id,name,email,designation,department,status,photo_url,last_login_at)`);
      return json(res, 200, { data: r.body || [] });
    } catch (err) { return json(res, 500, { error: { message: err.message } }); }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PARTICIPANT PORTAL
  // ══════════════════════════════════════════════════════════════════════════════

  if (pathname === '/api/v1/participant/cohorts' && method === 'GET') {
    if (currentUser.role !== 'PARTICIPANT') return json(res, 403, { error: { code: 'FORBIDDEN', message: 'Participant access only' } });
    try {
      const r = await sb('GET', `/rest/v1/enrollments?participant_id=eq.${currentUser.sub}&status=eq.active&order=enrolled_at.desc&select=id,status,enrolled_at,cohorts(id,name,cohort_code,program_type,status,start_date,end_date,organizations(id,display_name,logo_url))`);
      const cohorts = (r.body || []).map(e => ({
        enrollment_id: e.id,
        enrolled_at: e.enrolled_at,
        ...(e.cohorts || {}),
      }));
      return json(res, 200, { data: cohorts });
    } catch (err) { return json(res, 500, { error: { message: err.message } }); }
  }

  // 404
  return json(res, 404, { error: { code: 'NOT_FOUND', message: `${method} ${pathname} not found` } });
};
};
