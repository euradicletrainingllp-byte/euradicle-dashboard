const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();
router.use(authenticate);

// ── GET /cohorts/:cohortId/enrollments ───────────────────────────────────────
router.get('/:cohortId/enrollments', async (req, res, next) => {
  try {
    const { cohortId } = req.params;
    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role);
    const isOrgAdmin = req.user.role === ROLES.ORG_ADMIN;

    if (!isAdmin && !isOrgAdmin) return res.status(403).json({ error: { code: 'FORBIDDEN' } });

    if (isOrgAdmin) {
      const { data: cohort } = await supabase.from('cohorts').select('org_id').eq('id', cohortId).single();
      if (!cohort || cohort.org_id !== req.user.org_id) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }

    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('id,cohort_id,participant_id,enrolled_by,enrolled_at,status,withdrawn_at,withdrawn_by')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    const pids = (enrollments || []).map(e => e.participant_id);
    let userMap = {};
    if (pids.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id,name,display_name,photo_url,designation,department,email,status,last_login_at')
        .in('id', pids);
      (users || []).forEach(u => { userMap[u.id] = u; });
    }

    const data = (enrollments || []).map(e => ({ ...e, users: userMap[e.participant_id] || null }));
    res.json({ data });
  } catch (err) { next(err); }
});

// ── POST /cohorts/:cohortId/enrollments ──────────────────────────────────────
router.post('/:cohortId/enrollments', async (req, res, next) => {
  try {
    const { cohortId } = req.params;
    const { participant_id } = req.body;
    if (!participant_id) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'participant_id required' } });

    const { data: cohort } = await supabase.from('cohorts').select('status,enrollment_capacity,org_id').eq('id', cohortId).single();
    if (!cohort) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Cohort not found' } });

    if (!['draft', 'active'].includes(cohort.status)) {
      return res.status(400).json({ error: { code: 'COHORT_NOT_ENROLLABLE', message: 'Cannot enroll in completed or archived cohort' } });
    }

    if (req.user.role === ROLES.ORG_ADMIN && cohort.org_id !== req.user.org_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }

    const { data: participant } = await supabase.from('users').select('role,org_id,status').eq('id', participant_id).single();
    if (!participant || participant.role !== ROLES.PARTICIPANT) {
      return res.status(400).json({ error: { code: 'INVALID_PARTICIPANT', message: 'User is not a participant' } });
    }
    if (!['active', 'pending_first_login'].includes(participant.status)) {
      return res.status(400).json({ error: { code: 'PARTICIPANT_INACTIVE', message: 'Participant account is inactive' } });
    }

    if (cohort.enrollment_capacity) {
      const { count } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('cohort_id', cohortId).eq('status', 'active');
      if (count >= cohort.enrollment_capacity) {
        return res.status(422).json({ error: { code: 'COHORT_AT_CAPACITY', message: 'Cohort has reached enrollment capacity' } });
      }
    }

    const { data: dup } = await supabase.from('enrollments').select('id').eq('cohort_id', cohortId).eq('participant_id', participant_id).single();
    if (dup) return res.status(409).json({ error: { code: 'DUPLICATE_ENROLLMENT', message: 'Participant already enrolled' } });

    const { data, error } = await supabase.from('enrollments').insert({
      id: uuidv4(), cohort_id: cohortId, participant_id,
      enrolled_by: req.user.id, status: 'active',
    }).select().single();

    if (error) throw error;
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'enrollment.created', entityType: 'enrollment', entityId: data.id, afterState: { cohort_id: cohortId, participant_id }, req });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// ── POST /cohorts/:cohortId/enrollments/bulk ─────────────────────────────────
router.post('/:cohortId/enrollments/bulk', async (req, res, next) => {
  try {
    const { cohortId } = req.params;
    const { participant_ids } = req.body;
    if (!Array.isArray(participant_ids) || participant_ids.length === 0) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'participant_ids array required' } });
    }

    if (req.user.role === ROLES.ORG_ADMIN) {
      const { data: cohort } = await supabase.from('cohorts').select('org_id').eq('id', cohortId).single();
      if (!cohort || cohort.org_id !== req.user.org_id) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    } else if (![ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }

    const results = { enrolled: 0, failed: 0, errors: [] };
    for (const pid of participant_ids) {
      try {
        const { data: existing } = await supabase.from('enrollments').select('id,status').eq('cohort_id', cohortId).eq('participant_id', pid).single();
        if (existing) {
          if (existing.status === 'active') {
            results.failed++;
            results.errors.push({ participant_id: pid, error: 'Already enrolled' });
            continue;
          }
          await supabase.from('enrollments').update({ status: 'active', enrolled_by: req.user.id, enrolled_at: new Date().toISOString(), withdrawn_at: null, withdrawn_by: null }).eq('id', existing.id);
        } else {
          await supabase.from('enrollments').insert({ id: uuidv4(), cohort_id: cohortId, participant_id: pid, enrolled_by: req.user.id, status: 'active' });
        }
        results.enrolled++;
      } catch (e) {
        results.failed++;
        results.errors.push({ participant_id: pid, error: e.message });
      }
    }

    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'enrollment.bulk_imported', entityType: 'enrollment', entityId: cohortId, afterState: { count: results.enrolled }, req });
    res.json(results);
  } catch (err) { next(err); }
});

// ── DELETE /cohorts/:cohortId/enrollments/:enrollmentId ──────────────────────
router.delete('/:cohortId/enrollments/:enrollmentId', async (req, res, next) => {
  try {
    const { cohortId, enrollmentId } = req.params;

    if (req.user.role === ROLES.ORG_ADMIN) {
      const { data: cohort } = await supabase.from('cohorts').select('org_id').eq('id', cohortId).single();
      if (!cohort || cohort.org_id !== req.user.org_id) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    } else if (![ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN].includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }

    await supabase.from('enrollments')
      .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString(), withdrawn_by: req.user.id })
      .eq('id', enrollmentId);
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'enrollment.withdrawn', entityType: 'enrollment', entityId: enrollmentId, req });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
