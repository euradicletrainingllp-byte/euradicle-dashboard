const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Only participants may use these routes
function requireParticipant(req, res, next) {
  if (req.user.role !== 'PARTICIPANT') return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  next();
}

// ── GET /participant/cohorts ─────────────────────────────────────────────────
router.get('/cohorts', requireParticipant, async (req, res, next) => {
  try {
    // Step 1: active enrollments for this participant
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select('id,enrolled_at,cohort_id')
      .eq('participant_id', req.user.id)
      .eq('status', 'active');
    if (error) throw error;

    // Step 2: fetch cohort + org details
    const cohortIds = (enrollments || []).map(e => e.cohort_id);
    let cohortMap = {};
    if (cohortIds.length) {
      const { data: cohorts } = await supabase
        .from('cohorts')
        .select('id,name,cohort_code,program_type,status,start_date,end_date,enrollment_capacity,org_id')
        .in('id', cohortIds);

      const orgIds = [...new Set((cohorts || []).map(c => c.org_id).filter(Boolean))];
      let orgMap = {};
      if (orgIds.length) {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id,name,display_name')
          .in('id', orgIds);
        (orgs || []).forEach(o => { orgMap[o.id] = o; });
      }

      (cohorts || []).forEach(c => {
        cohortMap[c.id] = { ...c, organizations: orgMap[c.org_id] || null };
      });
    }

    const data = (enrollments || []).map(e => ({
      ...cohortMap[e.cohort_id],
      enrollment_id: e.id,
      enrolled_at: e.enrolled_at,
    })).filter(c => c.id); // drop any where cohort not found

    res.json({ data });
  } catch (err) { next(err); }
});

// ── GET /participant/cohorts/:id/content ─────────────────────────────────────
router.get('/cohorts/:id/content', requireParticipant, async (req, res, next) => {
  try {
    const { id: cohortId } = req.params;

    // Verify enrollment
    const { data: enr } = await supabase.from('enrollments')
      .select('id').eq('cohort_id', cohortId).eq('participant_id', req.user.id).eq('status', 'active').single();
    if (!enr) return res.status(403).json({ error: { code: 'NOT_ENROLLED' } });

    // Get assignments ordered by sequence
    const { data: assignments, error } = await supabase
      .from('content_assignments')
      .select('*,content_items(id,title,description,content_type,estimated_minutes,file_url,external_url)')
      .eq('cohort_id', cohortId)
      .eq('visibility_status', 'published')
      .order('sequence_order', { ascending: true });
    if (error) throw error;

    // Get progress for this enrollment
    const asgIds = (assignments || []).map(a => a.id);
    let progressMap = {};
    if (asgIds.length) {
      const { data: prog } = await supabase.from('content_progress')
        .select('content_assignment_id,completed,completed_at')
        .eq('enrollment_id', enr.id)
        .in('content_assignment_id', asgIds);
      (prog || []).forEach(p => { progressMap[p.content_assignment_id] = p; });
    }

    // Apply level-lock: item is locked if previous item is not completed
    let prevCompleted = true;
    const result = (assignments || []).map((a, i) => {
      const progress = progressMap[a.id] || null;
      const completed = progress?.completed || false;
      const locked = i > 0 && !prevCompleted;
      prevCompleted = completed;
      return { ...a, progress, locked };
    });

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ── GET /participant/cohorts/:id/assessments ─────────────────────────────────
router.get('/cohorts/:id/assessments', requireParticipant, async (req, res, next) => {
  try {
    const { id: cohortId } = req.params;

    const { data: enr } = await supabase.from('enrollments')
      .select('id').eq('cohort_id', cohortId).eq('participant_id', req.user.id).eq('status', 'active').single();
    if (!enr) return res.status(403).json({ error: { code: 'NOT_ENROLLED' } });

    const { data: assignments, error } = await supabase
      .from('assessment_assignments')
      .select('*,assessments(id,title,description,assessment_type,sections,timer_minutes,max_attempts)')
      .eq('cohort_id', cohortId);
    if (error) throw error;

    const asgIds = (assignments || []).map(a => a.id);
    let responseMap = {};
    if (asgIds.length) {
      const { data: responses } = await supabase.from('assessment_responses')
        .select('id,assignment_id,status,attempt_number,started_at,submitted_at,total_score')
        .eq('enrollment_id', enr.id)
        .in('assignment_id', asgIds)
        .order('attempt_number', { ascending: false });
      (responses || []).forEach(r => {
        if (!responseMap[r.assignment_id]) responseMap[r.assignment_id] = r;
      });
    }

    const result = (assignments || []).map(a => ({ ...a, my_response: responseMap[a.id] || null }));
    res.json({ data: result });
  } catch (err) { next(err); }
});

// ── POST /participant/assessments/:asgId/start ───────────────────────────────
router.post('/assessments/:asgId/start', requireParticipant, async (req, res, next) => {
  try {
    const { asgId } = req.params;

    const { data: asg } = await supabase.from('assessment_assignments')
      .select('*,assessments(id,title,sections,timer_minutes,max_attempts)')
      .eq('id', asgId).single();
    if (!asg) return res.status(404).json({ error: { message: 'Assignment not found' } });

    const { data: enr } = await supabase.from('enrollments')
      .select('id').eq('cohort_id', asg.cohort_id).eq('participant_id', req.user.id).eq('status', 'active').single();
    if (!enr) return res.status(403).json({ error: { code: 'NOT_ENROLLED' } });

    // Check for existing in-progress response (resume)
    const { data: existing } = await supabase.from('assessment_responses')
      .select('*').eq('assignment_id', asgId).eq('enrollment_id', enr.id).eq('status', 'in_progress').single();
    if (existing) return res.json({ data: existing, resumed: true });

    // Count attempts
    const { count: attempts } = await supabase.from('assessment_responses')
      .select('*', { count: 'exact', head: true }).eq('assignment_id', asgId).eq('enrollment_id', enr.id);
    const maxAttempts = asg.assessments?.max_attempts;
    if (maxAttempts && attempts >= maxAttempts) {
      return res.status(422).json({ error: { message: 'Maximum attempts reached' } });
    }

    const { data, error } = await supabase.from('assessment_responses').insert({
      id: uuidv4(), assignment_id: asgId, enrollment_id: enr.id,
      attempt_number: (attempts || 0) + 1, status: 'in_progress',
      answers: {}, started_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    res.status(201).json({ data, resumed: false });
  } catch (err) { next(err); }
});

// ── PATCH /participant/responses/:respId ─────────────────────────────────────
router.patch('/responses/:respId', requireParticipant, async (req, res, next) => {
  try {
    const { respId } = req.params;
    const { answers } = req.body;

    // Confirm ownership via enrollment
    const { data: resp } = await supabase.from('assessment_responses')
      .select('id,status,enrollment_id')
      .eq('id', respId).single();
    if (!resp) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    const { data: enrCheck } = await supabase.from('enrollments').select('participant_id').eq('id', resp.enrollment_id).single();
    if (!enrCheck || enrCheck.participant_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    if (resp.status !== 'in_progress') return res.status(400).json({ error: { message: 'Response already submitted' } });

    const { data, error } = await supabase.from('assessment_responses')
      .update({ answers }).eq('id', respId).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── POST /participant/responses/:respId/submit ───────────────────────────────
router.post('/responses/:respId/submit', requireParticipant, async (req, res, next) => {
  try {
    const { respId } = req.params;

    const { data: resp } = await supabase.from('assessment_responses')
      .select('id,status,enrollment_id,answers,assignment_id,assessment_assignments(assessments(sections))')
      .eq('id', respId).single();
    if (!resp) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    const { data: enrCheck } = await supabase.from('enrollments').select('participant_id').eq('id', resp.enrollment_id).single();
    if (!enrCheck || enrCheck.participant_id !== req.user.id) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    if (resp.status !== 'in_progress') return res.status(400).json({ error: { message: 'Already submitted' } });

    // Auto-score MCQ answers
    const answers = resp.answers || {};
    let autoScore = 0;
    const sections = resp.assessment_assignments?.assessments?.sections || [];
    sections.forEach(sec => {
      (sec.questions || []).forEach(q => {
        if (q.type === 'mcq' && q.correct_option != null) {
          const given = answers[q.id];
          if (given === q.correct_option) autoScore++;
        }
      });
    });

    const now = new Date().toISOString();
    const { data, error } = await supabase.from('assessment_responses')
      .update({ status: 'submitted', submitted_at: now, auto_score: autoScore })
      .eq('id', respId).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

// ── POST /participant/content-progress/:caId/complete ────────────────────────
router.post('/content-progress/:caId/complete', requireParticipant, async (req, res, next) => {
  try {
    const { caId } = req.params;

    // Verify the content assignment belongs to a cohort the participant is in
    const { data: ca } = await supabase.from('content_assignments').select('id,cohort_id').eq('id', caId).single();
    if (!ca) return res.status(404).json({ error: { message: 'Content assignment not found' } });

    const { data: enr } = await supabase.from('enrollments')
      .select('id').eq('cohort_id', ca.cohort_id).eq('participant_id', req.user.id).eq('status', 'active').single();
    if (!enr) return res.status(403).json({ error: { code: 'NOT_ENROLLED' } });

    const now = new Date().toISOString();
    // Upsert progress record
    const { data: existing } = await supabase.from('content_progress')
      .select('id').eq('content_assignment_id', caId).eq('enrollment_id', enr.id).single();

    let data, error;
    if (existing) {
      ({ data, error } = await supabase.from('content_progress')
        .update({ completed: true, completed_at: now, last_accessed_at: now })
        .eq('id', existing.id).select().single());
    } else {
      ({ data, error } = await supabase.from('content_progress').insert({
        id: uuidv4(), content_assignment_id: caId, enrollment_id: enr.id,
        completed: true, completed_at: now, accessed_at: now, last_accessed_at: now,
      }).select().single());
    }
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
