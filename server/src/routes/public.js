// ── Public routes — NO authentication required ────────────────────────────────
const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

// ── GET /public/cohorts/:id ──────────────────────────────────────────────────
router.get('/cohorts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: cohort, error } = await supabase
      .from('cohorts')
      .select('id,name,cohort_code,program_type,status,start_date,end_date,description,internal_notes,is_public,org_id,organizations(id,name,display_name,logo_url)')
      .eq('id', id)
      .eq('is_public', true)
      .is('deleted_at', null)
      .single();

    if (error || !cohort) {
      console.error('[public/cohorts] query error:', error?.message, '| cohort found:', !!cohort);
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This cohort is not publicly available.' } });
    }

    // ── Journey interventions ──────────────────────────────────────────────────
    // Get the active journey for this cohort
    const { data: journey } = await supabase
      .from('cohort_journeys')
      .select('id,name')
      .eq('cohort_id', id)
      .eq('is_active', true)
      .single();

    let interventions = [];
    if (journey) {
      const { data: rawInterventions } = await supabase
        .from('journey_interventions')
        .select('id,title,intervention_type,sequence_order,description,scheduled_date,scheduled_time,scheduled_end_time,duration_minutes,location,is_mandatory,status,is_public,content_item_id,content_items(id,title,content_type,estimated_minutes),assessments(id,title,assessment_type)')
        .eq('journey_id', journey.id)
        .eq('status', 'published')
        .order('sequence_order', { ascending: true });

      interventions = (rawInterventions || []).map(iv => ({
        id: iv.id,
        title: iv.title,
        intervention_type: iv.intervention_type,
        sequence_order: iv.sequence_order,
        scheduled_date: iv.scheduled_date,
        scheduled_time: iv.scheduled_time,
        scheduled_end_time: iv.scheduled_end_time,
        duration_minutes: iv.duration_minutes,
        location: iv.location,
        is_mandatory: iv.is_mandatory,
        is_public: iv.is_public,
        // Only expose description + linked item details when is_public = true
        description: iv.is_public ? iv.description : null,
        content_item: iv.is_public ? (iv.content_items ? { title: iv.content_items.title, content_type: iv.content_items.content_type, estimated_minutes: iv.content_items.estimated_minutes } : null) : null,
        assessment: iv.is_public ? (iv.assessments ? { title: iv.assessments.title, assessment_type: iv.assessments.assessment_type } : null) : null,
      }));
    }

    // ── Content assignments ────────────────────────────────────────────────────
    const { data: contentAssignments } = await supabase
      .from('content_assignments')
      .select('id,sequence_order,is_public,content_items(id,title,content_type,estimated_minutes,description)')
      .eq('cohort_id', id)
      .eq('visibility_status', 'published')
      .order('sequence_order', { ascending: true });

    const content = (contentAssignments || []).map(ca => ({
      id: ca.id,
      sequence_order: ca.sequence_order,
      is_public: ca.is_public,
      title: ca.content_items?.title || 'Untitled',
      content_type: ca.content_items?.content_type,
      estimated_minutes: ca.content_items?.estimated_minutes,
      // Description only when publicly unlocked
      description: ca.is_public ? (ca.content_items?.description || null) : null,
    }));

    // ── Assessment assignments ─────────────────────────────────────────────────
    const { data: assessmentAssignments } = await supabase
      .from('assessment_assignments')
      .select('id,is_public,assessments(id,title,assessment_type,timer_minutes,description)')
      .eq('cohort_id', id);

    const assessments = (assessmentAssignments || []).map(aa => ({
      id: aa.id,
      is_public: aa.is_public,
      title: aa.assessments?.title || 'Untitled',
      assessment_type: aa.assessments?.assessment_type,
      timer_minutes: aa.assessments?.timer_minutes,
      description: aa.is_public ? (aa.assessments?.description || null) : null,
    }));

    res.json({
      data: {
        id: cohort.id,
        name: cohort.name,
        cohort_code: cohort.cohort_code,
        program_type: cohort.program_type,
        status: cohort.status,
        start_date: cohort.start_date,
        end_date: cohort.end_date,
        description: cohort.description || null,
        organization: cohort.organizations,
        journey: journey ? { id: journey.id, name: journey.name, interventions } : null,
        content,
        assessments,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
