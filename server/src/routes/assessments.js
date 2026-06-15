const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();
router.use(authenticate);

// ── GET /assessments ─────────────────────────────────────────────────────────
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { library_status, assessment_type, page = 1, limit = 20 } = req.query;
    let query = supabase.from('assessments').select('id,title,description,assessment_type,library_status,timer_minutes,created_at', { count: 'exact' }).is('deleted_at', null);

    if (library_status) query = query.eq('library_status', library_status);
    if (assessment_type) query = query.eq('assessment_type', assessment_type);

    const offset = (page - 1) * limit;
    const { data, error, count } = await query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
});

// ── POST /assessments ────────────────────────────────────────────────────────
router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { title, description, assessment_type, instructions, timer_minutes, allow_save_resume,
            shuffle_questions, shuffle_sections, show_progress_bar, max_attempts,
            retake_cooldown_hours, sections } = req.body;

    if (!title || !assessment_type) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'title and assessment_type required' } });

    const newAssessment = {
      id: uuidv4(), title, description, assessment_type, instructions,
      timer_minutes: timer_minutes || null,
      allow_save_resume: allow_save_resume !== false,
      shuffle_questions: shuffle_questions || false,
      shuffle_sections: shuffle_sections || false,
      show_progress_bar: show_progress_bar !== false,
      max_attempts: max_attempts || 1,
      retake_cooldown_hours: retake_cooldown_hours || null,
      sections: sections || [],
      library_status: 'draft',
      created_by: req.user.id,
    };

    const { data, error } = await supabase.from('assessments').insert(newAssessment).select().single();
    if (error) throw error;

    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'assessment.created', entityType: 'assessment', entityId: data.id, afterState: { title, assessment_type }, req });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// ── GET /assessments/:id ─────────────────────────────────────────────────────
router.get('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('assessments').select('*').eq('id', req.params.id).is('deleted_at', null).single();
    if (error || !data) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    res.json({ data });
  } catch (err) { next(err); }
});

// ── PATCH /assessments/:id ───────────────────────────────────────────────────
router.patch('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    // Cannot edit if any responses exist
    const { count } = await supabase.from('assessment_responses').select('*', { count: 'exact', head: true }).eq('assignment_id', id);
    if (count > 0) return res.status(400).json({ error: { code: 'HAS_RESPONSES', message: 'Cannot edit assessment with existing responses' } });

    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id; delete updates.created_by;

    const { data, error } = await supabase.from('assessments').update(updates).eq('id', id).select().single();
    if (error) throw error;

    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'assessment.updated', entityType: 'assessment', entityId: id, req });
    res.json({ data });
  } catch (err) { next(err); }
});

// ── POST /assessments/:id/publish ────────────────────────────────────────────
router.post('/:id/publish', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    await supabase.from('assessments').update({ library_status: 'published', updated_at: new Date().toISOString() }).eq('id', id);
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'assessment.published', entityType: 'assessment', entityId: id, req });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── DELETE /assessments/:id (soft-delete) ────────────────────────────────────
router.delete('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('assessments')
      .update({ deleted_at: new Date().toISOString(), library_status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'assessment.deleted', entityType: 'assessment', entityId: id, req });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /assessments/:id/responses ───────────────────────────────────────────
router.get('/:id/responses', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: assignments, error: aErr } = await supabase
      .from('assessment_assignments')
      .select('id, cohort_id, access_open, access_close, mandatory, cohorts(id, name, cohort_code)')
      .eq('assessment_id', id);
    if (aErr) throw aErr;

    const assignmentIds = (assignments || []).map(a => a.id);
    let responses = [];
    if (assignmentIds.length) {
      // Fetch responses (flat, no nested joins to avoid FK ambiguity on enrollments→users)
      const { data: r, error: rErr } = await supabase
        .from('assessment_responses')
        .select('id, assignment_id, enrollment_id, status, total_score, auto_score, submitted_at, time_taken_seconds, attempt_number')
        .in('assignment_id', assignmentIds)
        .order('submitted_at', { ascending: false });
      if (rErr) throw rErr;

      // Fetch enrollments separately to avoid the 3-way FK ambiguity (enrolled_by / participant_id / withdrawn_by → users)
      const enrollmentIds = [...new Set((r || []).map(x => x.enrollment_id).filter(Boolean))];
      let participantMap = {};
      if (enrollmentIds.length) {
        const { data: enrs } = await supabase
          .from('enrollments')
          .select('id, participant_id')
          .in('id', enrollmentIds);

        const userIds = [...new Set((enrs || []).map(e => e.participant_id).filter(Boolean))];
        let userMap = {};
        if (userIds.length) {
          const { data: users } = await supabase
            .from('users')
            .select('id, name, display_name, email, designation, photo_url')
            .in('id', userIds);
          (users || []).forEach(u => { userMap[u.id] = u; });
        }
        (enrs || []).forEach(e => {
          participantMap[e.id] = { ...e, user: userMap[e.participant_id] || null };
        });
      }

      responses = (r || []).map(resp => ({
        ...resp,
        enrollment: participantMap[resp.enrollment_id] || null,
      }));
    }

    res.json({ assignments: assignments || [], data: responses });
  } catch (err) { next(err); }
});

module.exports = router;
