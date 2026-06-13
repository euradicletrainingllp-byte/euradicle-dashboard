const express = require('express');
const supabase = require('../config/supabase');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN));

// Helper: verify org-admin owns the cohort
async function verifyCohortAccess(req, cohortId) {
  if ([ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role)) return true;
  const { data } = await supabase.from('cohorts').select('org_id').eq('id', cohortId).single();
  return data && data.org_id === req.user.org_id;
}

// ── GET /org-admin/cohorts ───────────────────────────────────────────────────
router.get('/cohorts', async (req, res, next) => {
  try {
    const orgId = req.user.role === ROLES.ORG_ADMIN ? req.user.org_id : null;

    let query = supabase
      .from('cohorts')
      .select('id,name,cohort_code,program_type,status,start_date,end_date,enrollment_capacity,org_id,created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (orgId) query = query.eq('org_id', orgId);

    const { data: cohorts, error } = await query;
    if (error) throw error;

    // Compute active enrollment counts
    const cohortIds = (cohorts || []).map(c => c.id);
    let countMap = {};
    if (cohortIds.length) {
      const { data: enrolls } = await supabase
        .from('enrollments')
        .select('cohort_id')
        .in('cohort_id', cohortIds)
        .eq('status', 'active');
      (enrolls || []).forEach(e => { countMap[e.cohort_id] = (countMap[e.cohort_id] || 0) + 1; });
    }

    const data = (cohorts || []).map(c => ({ ...c, enrollment_count: countMap[c.id] || 0 }));
    res.json({ data });
  } catch (err) { next(err); }
});

// ── GET /org-admin/cohorts/:id/participants ──────────────────────────────────
router.get('/cohorts/:id/participants', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!await verifyCohortAccess(req, id)) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('id,enrolled_at,status,participant_id')
      .eq('cohort_id', id)
      .eq('status', 'active');
    if (error) throw error;

    const pids = (enrollments || []).map(e => e.participant_id);
    let userMap = {};
    if (pids.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id,name,display_name,email,designation,department,phone')
        .in('id', pids);
      (users || []).forEach(u => { userMap[u.id] = u; });
    }

    const data = (enrollments || []).map(e => ({ ...e, users: userMap[e.participant_id] || null }));
    res.json({ data });
  } catch (err) { next(err); }
});

// ── GET /org-admin/cohorts/:id/assessments ───────────────────────────────────
router.get('/cohorts/:id/assessments', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!await verifyCohortAccess(req, id)) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    const { data, error } = await supabase
      .from('assessment_assignments')
      .select('*,assessments(id,title,description,assessment_type,sections,timer_minutes)')
      .eq('cohort_id', id);
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── GET /org-admin/cohorts/:id/content ──────────────────────────────────────
router.get('/cohorts/:id/content', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!await verifyCohortAccess(req, id)) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    const { data, error } = await supabase
      .from('content_assignments')
      .select('*,content_items(id,title,description,content_type,estimated_minutes,external_url,file_url)')
      .eq('cohort_id', id)
      .order('sequence_order', { ascending: true });
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
