const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();
router.use(authenticate);

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
}

// ── GET /organizations ───────────────────────────────────────────────────────
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    let query = supabase.from('organizations').select('id,name,display_name,slug,logo_url,industry,status,primary_contact_name,primary_contact_email,created_at', { count: 'exact' }).is('deleted_at', null);

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`name.ilike.%${search}%,display_name.ilike.%${search}%`);

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
});

// ── POST /organizations ──────────────────────────────────────────────────────
router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { name, display_name, industry, primary_contact_name, primary_contact_email, primary_contact_phone, internal_notes, participant_creation_by_org_admin } = req.body;

    if (!name || !display_name) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'name and display_name required' } });

    let slug = slugify(name);
    // Ensure unique slug
    const { data: existing } = await supabase.from('organizations').select('id').eq('slug', slug).single();
    if (existing) slug = `${slug}-${uuidv4().substring(0, 4)}`;

    const newOrg = {
      id: uuidv4(), name, display_name, slug, industry,
      primary_contact_name, primary_contact_email, primary_contact_phone,
      internal_notes, participant_creation_by_org_admin: participant_creation_by_org_admin || false,
      status: 'active', created_by: req.user.id,
    };

    const { data, error } = await supabase.from('organizations').insert(newOrg).select().single();
    if (error) throw error;

    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'organization.created', entityType: 'organization', entityId: data.id, afterState: { name, display_name, slug }, req });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// ── GET /organizations/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role);
    const isOrgAdmin = req.user.role === ROLES.ORG_ADMIN;

    if (!isAdmin && !isOrgAdmin) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    if (isOrgAdmin && req.user.org_id !== id) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Can only access your own organization' } });

    const { data, error } = await supabase.from('organizations').select('*').eq('id', id).is('deleted_at', null).single();
    if (error || !data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Organization not found' } });

    // Hide internal fields from ORG_ADMIN
    if (isOrgAdmin) { delete data.internal_notes; delete data.contract_tags; }

    // Snapshot metrics
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('org_id', id).is('deleted_at', null);
    const { count: cohortCount } = await supabase.from('cohorts').select('*', { count: 'exact', head: true }).eq('org_id', id).is('deleted_at', null);

    res.json({ data: { ...data, metrics: { total_users: userCount, total_cohorts: cohortCount } } });
  } catch (err) { next(err); }
});

// ── PATCH /organizations/:id ─────────────────────────────────────────────────
router.patch('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: before } = await supabase.from('organizations').select('*').eq('id', id).single();
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id; delete updates.slug; delete updates.created_by;

    const { data, error } = await supabase.from('organizations').update(updates).eq('id', id).select().single();
    if (error) throw error;

    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'organization.updated', entityType: 'organization', entityId: id, beforeState: before, afterState: updates, req });
    res.json({ data });
  } catch (err) { next(err); }
});

// ── POST /organizations/:id/suspend ──────────────────────────────────────────
router.post('/:id/suspend', authorize(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    await supabase.from('organizations').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', id);
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'organization.suspended', entityType: 'organization', entityId: id, req });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /organizations/:id/analytics ─────────────────────────────────────────
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role);
    const isOrgAdmin = req.user.role === ROLES.ORG_ADMIN && req.user.org_id === id;

    if (!isAdmin && !isOrgAdmin) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });

    const [{ count: totalParticipants }, { count: activeCohorts }, { data: cohorts }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('org_id', id).eq('role', 'PARTICIPANT').is('deleted_at', null),
      supabase.from('cohorts').select('*', { count: 'exact', head: true }).eq('org_id', id).eq('status', 'active').is('deleted_at', null),
      supabase.from('cohorts').select('id,name,status,health_score,health_label').eq('org_id', id).is('deleted_at', null),
    ]);

    res.json({ data: { total_participants: totalParticipants, active_cohorts: activeCohorts, cohorts } });
  } catch (err) { next(err); }
});

module.exports = router;
