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

// ── GET /org-admin/cohorts/:id/participants ──────────────────────────────────
router.get('/cohorts/:id/participants', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!await verifyCohortAccess(req, id)) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    const { data, error } = await supabase
      .from('enrollments')
      .select('id,enrolled_at,status,participant_id,users!enrollments_participant_id_fkey(id,name,display_name,email,designation,department,phone)')
      .eq('cohort_id', id)
      .eq('status', 'active');
    if (error) throw error;
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
