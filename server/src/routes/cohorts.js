const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();
router.use(authenticate);

// Generate cohort code: [ORG_SLUG_4]-[PROG_3]-[YYYYMM]-[RAND4]
async function generateCohortCode(orgSlug, programType) {
  const typeMap = { leadership_dev: 'LEA', ac_dc: 'ACD', behavioral: 'BEH', consulting_capability: 'CON', custom: 'CUS' };
  const rand = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const yyyymm = new Date().toISOString().substring(0, 7).replace('-', '');
  const base = `${(orgSlug || 'UNKN').substring(0, 4).toUpperCase()}-${typeMap[programType] || 'CUS'}-${yyyymm}`;

  let code, exists = true;
  while (exists) {
    code = `${base}-${rand()}`;
    const { data } = await supabase.from('cohorts').select('id').eq('cohort_code', code).single();
    exists = !!data;
  }
  return code;
}

// ── GET /cohorts ─────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { org_id, status, program_type, health_label, page = 1, limit = 20 } = req.query;

    let query = supabase.from('cohorts')
      .select(`id,name,cohort_code,program_type,status,start_date,end_date,health_score,health_label,enrollment_capacity,created_at,
        organizations(id,name,display_name,logo_url)`, { count: 'exact' })
      .is('deleted_at', null);

    // ORG_ADMIN sees only own org
    if (req.user.role === ROLES.ORG_ADMIN) {
      query = query.eq('org_id', req.user.org_id);
    } else {
      if (org_id) query = query.eq('org_id', org_id);
    }

    if (status) query = query.eq('status', status);
    if (program_type) query = query.eq('program_type', program_type);
    if (health_label) query = query.eq('health_label', health_label);

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
});

// ── POST /cohorts ─────────────────────────────────────────────────────────────
router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { name, org_id, program_type, internal_notes, cohort_code: customCode,
            start_date, end_date, pre_assessment_open, pre_assessment_close,
            content_access_start, content_access_end, post_program_access_days,
            enrollment_capacity } = req.body;

    if (!name || !org_id || !program_type) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'name, org_id, program_type required' } });
    if (start_date && end_date && new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({ error: { code: 'INVALID_DATES', message: 'end_date must be after start_date' } });
    }
    if (pre_assessment_close && end_date && new Date(pre_assessment_close) > new Date(end_date)) {
      return res.status(400).json({ error: { code: 'INVALID_DATES', message: 'pre_assessment_close must be <= end_date' } });
    }

    const { data: org } = await supabase.from('organizations').select('slug,status').eq('id', org_id).single();
    if (!org || org.status !== 'active') return res.status(400).json({ error: { code: 'INVALID_ORG', message: 'Organization not found or not active' } });

    const code = customCode || await generateCohortCode(org.slug, program_type);

    const newCohort = {
      id: uuidv4(), name, org_id, program_type, cohort_code: code,
      status: 'draft', internal_notes,
      start_date, end_date, pre_assessment_open, pre_assessment_close,
      content_access_start, content_access_end,
      post_program_access_days: post_program_access_days || 30,
      enrollment_capacity: enrollment_capacity || null,
      health_score: null, health_label: 'grey',
      created_by: req.user.id,
    };

    const { data, error } = await supabase.from('cohorts').insert(newCohort).select().single();
    if (error) throw error;

    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'cohort.created', entityType: 'cohort', entityId: data.id, afterState: { name, org_id, program_type, code }, req });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// ── GET /cohorts/:id ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // PARTICIPANT: verify they are enrolled in this cohort before returning data
    if (req.user.role === ROLES.PARTICIPANT) {
      const { data: enroll } = await supabase.from('enrollments')
        .select('id').eq('cohort_id', id).eq('participant_id', req.user.id).eq('status', 'active').single();
      if (!enroll) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found' } });
    }

    let query = supabase.from('cohorts').select(`*,organizations(id,name,display_name,logo_url)`).eq('id', id).is('deleted_at', null);
    if (req.user.role === ROLES.ORG_ADMIN) query = query.eq('org_id', req.user.org_id);

    const { data, error } = await query.single();
    if (error || !data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found' } });

    // Enrollment count (only for admins — not needed for participants)
    let enrollment_count = undefined;
    if (req.user.role !== ROLES.PARTICIPANT) {
      const { count } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('cohort_id', id).eq('status', 'active');
      enrollment_count = count;
    }
    res.json({ data: { ...data, ...(enrollment_count !== undefined && { enrollment_count }) } });
  } catch (err) { next(err); }
});

// ── PATCH /cohorts/:id ───────────────────────────────────────────────────────
router.patch('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: cohort } = await supabase.from('cohorts').select('status,cohort_code').eq('id', id).single();
    if (!cohort) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found' } });

    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id; delete updates.org_id; delete updates.created_by;

    // Can't edit cohort_code after active
    if (cohort.status !== 'draft' && updates.cohort_code) delete updates.cohort_code;

    const { data, error } = await supabase.from('cohorts').update(updates).eq('id', id).select().single();
    if (error) throw error;

    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'cohort.updated', entityType: 'cohort', entityId: id, afterState: updates, req });
    res.json({ data });
  } catch (err) { next(err); }
});

// ── POST /cohorts/:id/launch ─────────────────────────────────────────────────
router.post('/:id/launch', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: cohort } = await supabase.from('cohorts').select('*').eq('id', id).single();
    if (!cohort) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found' } });
    if (cohort.status !== 'draft') return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Only draft cohorts can be launched' } });

    // BR-05: Must have at least 1 enrollment
    const { count } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('cohort_id', id).eq('status', 'active');
    if (!count || count < 1) return res.status(400).json({ error: { code: 'NO_ENROLLMENTS', message: 'Cohort must have at least 1 enrollment before launch' } });

    await supabase.from('cohorts').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', id);
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'cohort.launched', entityType: 'cohort', entityId: id, req });

    // TODO: Queue participant invite emails
    res.json({ success: true, message: 'Cohort launched successfully' });
  } catch (err) { next(err); }
});

// ── POST /cohorts/:id/complete ────────────────────────────────────────────────
router.post('/:id/complete', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    await supabase.from('cohorts').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id);
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'cohort.completed', entityType: 'cohort', entityId: id, req });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /cohorts/:id/analytics ────────────────────────────────────────────────
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: cohort } = await supabase.from('cohorts').select('*,organizations(name)').eq('id', id).single();
    if (!cohort) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found' } });

    const [{ count: enrolled }, { count: completed }] = await Promise.all([
      supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('cohort_id', id).eq('status', 'active'),
      supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('cohort_id', id).eq('status', 'completed'),
    ]);

    res.json({
      data: {
        cohort_summary: { ...cohort, org_name: cohort.organizations?.name, enrollment_count: enrolled },
        completion_count: completed,
      }
    });
  } catch (err) { next(err); }
});

// ── GET /cohorts/:id/audit ────────────────────────────────────────────────────
router.get('/:id/audit', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('audit_logs').select('*').eq('entity_id', id).eq('entity_type', 'cohort').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ASSESSMENT ASSIGNMENTS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/:id/assessments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('assessment_assignments')
      .select('*,assessments(id,title,description,assessment_type,library_status,sections,timer_minutes,max_attempts)')
      .eq('cohort_id', id);
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/assessments', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assessment_id, access_open, access_close, mandatory } = req.body;
    if (!assessment_id) return res.status(400).json({ error: { message: 'assessment_id required' } });
    const { data: existing } = await supabase.from('assessment_assignments').select('id').eq('cohort_id', id).eq('assessment_id', assessment_id).single();
    if (existing) return res.status(409).json({ error: { message: 'This assessment is already assigned to this cohort' } });
    const { data, error } = await supabase.from('assessment_assignments').insert({
      id: uuidv4(), cohort_id: id, assessment_id,
      access_open: access_open || null,
      access_close: access_close || null,
      mandatory: mandatory ?? true,
    }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id/assessments/:assignId', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { assignId } = req.params;
    const { error } = await supabase.from('assessment_assignments').delete().eq('id', assignId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT ASSIGNMENTS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/:id/content', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('content_assignments')
      .select('*,content_items(id,title,description,content_type,library_status,estimated_minutes,file_url,external_url,tags_competency,tags_industry,tags_level,tags_program_type)')
      .eq('cohort_id', id)
      .order('sequence_order', { ascending: true });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/content', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content_item_id, module_name, sequence_order, is_mandatory, mandatory, visibility_status, release_at, access_until } = req.body;
    if (!content_item_id) return res.status(400).json({ error: { message: 'content_item_id required' } });
    const { data: existing } = await supabase.from('content_assignments').select('id').eq('cohort_id', id).eq('content_item_id', content_item_id).single();
    if (existing) return res.status(409).json({ error: { message: 'This content is already assigned to this cohort' } });
    // Auto-assign sequence_order if not provided
    let order = sequence_order;
    if (order == null) {
      const { count } = await supabase.from('content_assignments').select('*', { count: 'exact', head: true }).eq('cohort_id', id);
      order = count || 0;
    }
    const { data, error } = await supabase.from('content_assignments').insert({
      id: uuidv4(), cohort_id: id, content_item_id,
      module_name: module_name || 'General',
      sequence_order: order,
      mandatory: is_mandatory ?? mandatory ?? false,
      visibility_status: visibility_status || 'published',
      release_at: release_at || null,
      access_until: access_until || null,
    }).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id/content/:assignId', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { assignId } = req.params;
    const { error } = await supabase.from('content_assignments').delete().eq('id', assignId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
