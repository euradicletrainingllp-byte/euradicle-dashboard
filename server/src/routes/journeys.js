const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getCohortAndCheckAccess(cohortId, user) {
  const { data: cohort } = await supabase.from('cohorts')
    .select('id, org_id, status')
    .eq('id', cohortId)
    .is('deleted_at', null)
    .single();
  if (!cohort) return null;

  if (user.role === ROLES.ORG_ADMIN && cohort.org_id !== user.org_id) return null;
  if (user.role === ROLES.PARTICIPANT) {
    // Check enrollment
    const { data: enroll } = await supabase.from('enrollments')
      .select('id').eq('cohort_id', cohortId).eq('participant_id', user.id).eq('status', 'active').single();
    if (!enroll) return null;
  }
  return cohort;
}

// ── GET /cohorts/:cohortId/journey  (get or create active journey) ────────────
router.get('/cohorts/:cohortId/journey', async (req, res, next) => {
  try {
    const { cohortId } = req.params;
    const cohort = await getCohortAndCheckAccess(cohortId, req.user);
    if (!cohort) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found or access denied' } });

    let { data: journey } = await supabase.from('cohort_journeys')
      .select('*').eq('cohort_id', cohortId).eq('is_active', true).single();

    if (!journey && [ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role)) {
      // Auto-create a journey for super admins
      const { data: created } = await supabase.from('cohort_journeys').insert({
        id: uuidv4(), cohort_id: cohortId, name: 'Learning Journey',
        is_active: true, created_by: req.user.id,
      }).select().single();
      journey = created;
    }

    if (!journey) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No journey configured yet' } });

    // Fetch interventions
    let interventionQuery = supabase.from('journey_interventions')
      .select(`*, content_items(id, title, content_type, file_url, external_url, estimated_minutes)`)
      .eq('journey_id', journey.id)
      .order('sequence_order', { ascending: true });

    // Participants only see published interventions that are released
    if (req.user.role === ROLES.PARTICIPANT) {
      interventionQuery = interventionQuery.eq('status', 'published');
    }

    const { data: interventions } = await interventionQuery;

    res.json({ data: { ...journey, interventions: interventions || [] } });
  } catch (err) { next(err); }
});

// ── POST /cohorts/:cohortId/journey/interventions ─────────────────────────────
router.post('/cohorts/:cohortId/journey/interventions',
  authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN),
  async (req, res, next) => {
    try {
      const { cohortId } = req.params;
      const cohort = await getCohortAndCheckAccess(cohortId, req.user);
      if (!cohort) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found' } });

      // Get or create journey
      let { data: journey } = await supabase.from('cohort_journeys')
        .select('id').eq('cohort_id', cohortId).eq('is_active', true).single();
      if (!journey) {
        const { data: created } = await supabase.from('cohort_journeys').insert({
          id: uuidv4(), cohort_id: cohortId, name: 'Learning Journey',
          is_active: true, created_by: req.user.id,
        }).select().single();
        journey = created;
      }

      const {
        title, intervention_type, sequence_order, description, facilitator_notes,
        scheduled_date, scheduled_time, duration_minutes,
        virtual_session_link, virtual_session_platform,
        content_item_id, release_at, access_until, is_mandatory, status,
      } = req.body;

      if (!title || !intervention_type) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'title and intervention_type are required' } });
      }

      // Auto sequence_order if not provided
      let order = sequence_order;
      if (order === undefined || order === null) {
        const { count } = await supabase.from('journey_interventions')
          .select('*', { count: 'exact', head: true }).eq('journey_id', journey.id);
        order = (count || 0);
      }

      const { data, error } = await supabase.from('journey_interventions').insert({
        id: uuidv4(), journey_id: journey.id, cohort_id: cohortId,
        title, intervention_type, sequence_order: order,
        description, facilitator_notes, scheduled_date, scheduled_time,
        duration_minutes, virtual_session_link, virtual_session_platform,
        content_item_id: content_item_id || null,
        release_at, access_until,
        is_mandatory: is_mandatory !== false,
        status: status || 'published',
      }).select('*, content_items(id, title, content_type)').single();

      if (error) throw error;
      res.status(201).json({ data });
    } catch (err) { next(err); }
  }
);

// ── PATCH /cohorts/:cohortId/journey/interventions/reorder ────────────────────
// IMPORTANT: this must be declared BEFORE /:interventionId to avoid "reorder"
// being captured as a param value.
// Body: { order: [{ id, sequence_order }] }
router.patch('/cohorts/:cohortId/journey/interventions/reorder',
  authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN),
  async (req, res, next) => {
    try {
      const { cohortId } = req.params;
      const { order } = req.body;
      if (!Array.isArray(order)) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'order must be array' } });

      await Promise.all(order.map(({ id, sequence_order }) =>
        supabase.from('journey_interventions')
          .update({ sequence_order, updated_at: new Date().toISOString() })
          .eq('id', id).eq('cohort_id', cohortId)
      ));
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

// ── PATCH /cohorts/:cohortId/journey/interventions/:interventionId ────────────
router.patch('/cohorts/:cohortId/journey/interventions/:interventionId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN),
  async (req, res, next) => {
    try {
      const { cohortId, interventionId } = req.params;
      const cohort = await getCohortAndCheckAccess(cohortId, req.user);
      if (!cohort) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found' } });

      const updates = { ...req.body, updated_at: new Date().toISOString() };
      delete updates.id; delete updates.journey_id; delete updates.cohort_id;

      const { data, error } = await supabase.from('journey_interventions')
        .update(updates).eq('id', interventionId).eq('cohort_id', cohortId)
        .select('*, content_items(id, title, content_type)').single();

      if (error) throw error;
      res.json({ data });
    } catch (err) { next(err); }
  }
);

// ── DELETE /cohorts/:cohortId/journey/interventions/:interventionId ────────────
router.delete('/cohorts/:cohortId/journey/interventions/:interventionId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN),
  async (req, res, next) => {
    try {
      const { cohortId, interventionId } = req.params;
      const { error } = await supabase.from('journey_interventions')
        .delete().eq('id', interventionId).eq('cohort_id', cohortId);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

// ── PATCH /cohorts/:cohortId/journey ─────────────────────────────────────────
router.patch('/cohorts/:cohortId/journey',
  authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN),
  async (req, res, next) => {
    try {
      const { cohortId } = req.params;
      const { name, description } = req.body;
      const { data, error } = await supabase.from('cohort_journeys')
        .update({ name, description, updated_at: new Date().toISOString() })
        .eq('cohort_id', cohortId).eq('is_active', true)
        .select().single();
      if (error) throw error;
      res.json({ data });
    } catch (err) { next(err); }
  }
);

// ── GET /participant/cohorts  (for PARTICIPANT role) ──────────────────────────
router.get('/participant/cohorts', async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.PARTICIPANT) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Participant access only' } });
    }

    const { data: enrollments, error } = await supabase.from('enrollments')
      .select(`id, status, enrolled_at, cohorts(id, name, cohort_code, program_type, status, start_date, end_date, organizations(id, display_name, logo_url))`)
      .eq('participant_id', req.user.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    const cohorts = (enrollments || []).map(e => ({
      enrollment_id: e.id,
      enrolled_at: e.enrolled_at,
      ...e.cohorts,
    }));

    res.json({ data: cohorts });
  } catch (err) { next(err); }
});

// ── GET /org-admin/cohorts  (for ORG_ADMIN role) ──────────────────────────────
router.get('/org-admin/cohorts', async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.ORG_ADMIN) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Org admin access only' } });
    }

    const { data, error } = await supabase.from('cohorts')
      .select(`id, name, cohort_code, program_type, status, start_date, end_date, health_score, health_label, enrollment_capacity, created_at`)
      .eq('org_id', req.user.org_id)
      .is('deleted_at', null)
      .in('status', ['active', 'draft', 'completed'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with enrollment counts
    const enriched = await Promise.all((data || []).map(async (c) => {
      const { count } = await supabase.from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('cohort_id', c.id).eq('status', 'active');
      return { ...c, enrollment_count: count || 0 };
    }));

    res.json({ data: enriched });
  } catch (err) { next(err); }
});

// ── GET /org-admin/cohorts/:id/participants ───────────────────────────────────
router.get('/org-admin/cohorts/:cohortId/participants', async (req, res, next) => {
  try {
    if (req.user.role !== ROLES.ORG_ADMIN) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Org admin access only' } });
    }
    const { cohortId } = req.params;

    // Verify cohort belongs to this org
    const { data: cohort } = await supabase.from('cohorts')
      .select('id').eq('id', cohortId).eq('org_id', req.user.org_id).single();
    if (!cohort) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found' } });

    const { data, error } = await supabase.from('enrollments')
      .select(`id, status, enrolled_at, users(id, name, email, designation, department, status, photo_url, last_login_at)`)
      .eq('cohort_id', cohortId)
      .neq('status', 'withdrawn')
      .order('enrolled_at', { ascending: true });

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) { next(err); }
});

module.exports = router;
