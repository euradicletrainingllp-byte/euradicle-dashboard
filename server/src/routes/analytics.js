// Analytics routes
const express = require('express');
const router = express.Router();
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const supabase = require('../config/supabase');

router.use(authenticate);

// ── GET /analytics/platform ──────────────────────────────────────────────────
// Operational + business metrics for super admin dashboard
router.get('/platform', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    // Run all queries in parallel
    const [
      cohortsRes,
      enrollmentsRes,
      contentProgressRes,
      contentAssignmentsRes,
      assessmentResponsesRes,
      assessmentAssignmentsRes,
      orgsRes,
      contentItemsRes,
      assessmentsRes,
    ] = await Promise.all([
      supabase.from('cohorts').select('id,status,program_type,org_id,created_at').is('deleted_at', null),
      supabase.from('enrollments').select('id,cohort_id,status,enrolled_at'),
      supabase.from('content_progress').select('id,completed,content_assignment_id'),
      supabase.from('content_assignments').select('id,cohort_id,visibility_status').eq('visibility_status', 'published'),
      supabase.from('assessment_responses').select('id,assignment_id,status,submitted_at,auto_score,total_score'),
      supabase.from('assessment_assignments').select('id,cohort_id,assessment_id'),
      supabase.from('organizations').select('id,name,display_name,status').eq('status', 'active'),
      supabase.from('content_items').select('id,content_type,library_status').is('deleted_at', null),
      supabase.from('assessments').select('id,assessment_type,library_status').is('deleted_at', null),
    ]);

    const cohorts     = cohortsRes.data || [];
    const enrollments = enrollmentsRes.data || [];
    const contentProgress = contentProgressRes.data || [];
    const contentAssignments = contentAssignmentsRes.data || [];
    const assessmentResponses = assessmentResponsesRes.data || [];
    const assessmentAssignments = assessmentAssignmentsRes.data || [];
    const orgs        = orgsRes.data || [];
    const contentItems = contentItemsRes.data || [];
    const assessments  = assessmentsRes.data || [];

    // ── Cohort breakdown ───────────────────────────────────────────────────
    const cohortByStatus = cohorts.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1; return acc;
    }, {});
    const cohortByProgram = cohorts.reduce((acc, c) => {
      const pt = c.program_type || 'unknown';
      acc[pt] = (acc[pt] || 0) + 1; return acc;
    }, {});

    // ── Enrollment metrics ─────────────────────────────────────────────────
    const activeEnrollments = enrollments.filter(e => e.status === 'active').length;
    const completedEnrollments = enrollments.filter(e => e.status === 'completed').length;

    // Enrollments per cohort (active cohorts only)
    const activeCohortIds = new Set(cohorts.filter(c => c.status === 'active').map(c => c.id));
    const enrollmentsInActiveCohorts = enrollments.filter(e => activeCohortIds.has(e.cohort_id) && e.status === 'active').length;

    // ── Content metrics ────────────────────────────────────────────────────
    const totalContentAssignments = contentAssignments.length;
    const completedContentProgress = contentProgress.filter(p => p.completed).length;
    const contentCompletionRate = totalContentAssignments > 0
      ? Math.round((completedContentProgress / totalContentAssignments) * 100)
      : 0;

    const contentByType = contentItems.reduce((acc, c) => {
      const ct = c.content_type || 'other';
      acc[ct] = (acc[ct] || 0) + 1; return acc;
    }, {});

    const publishedContent = contentItems.filter(c => c.library_status === 'published').length;
    const draftContent = contentItems.filter(c => c.library_status === 'draft').length;

    // ── Assessment metrics ─────────────────────────────────────────────────
    const totalAssignmentSlots = assessmentAssignments.length; // assignments
    const totalSubmitted = assessmentResponses.filter(r => r.status === 'submitted').length;
    const assessmentSubmissionRate = totalAssignmentSlots > 0 && activeEnrollments > 0
      ? Math.round((totalSubmitted / (totalAssignmentSlots * Math.max(enrollmentsInActiveCohorts, 1))) * 100)
      : 0;

    const publishedAssessments = assessments.filter(a => a.library_status === 'published').length;
    const assessmentByType = assessments.reduce((acc, a) => {
      const at = a.assessment_type || 'other';
      acc[at] = (acc[at] || 0) + 1; return acc;
    }, {});

    // ── Org metrics ────────────────────────────────────────────────────────
    const orgEnrollmentMap = {};
    const orgCohortMap = {};
    cohorts.forEach(c => {
      const oid = c.org_id;
      if (!oid) return;
      orgCohortMap[oid] = (orgCohortMap[oid] || 0) + 1;
    });
    enrollments.filter(e => e.status === 'active').forEach(e => {
      const cohort = cohorts.find(c => c.id === e.cohort_id);
      if (!cohort?.org_id) return;
      orgEnrollmentMap[cohort.org_id] = (orgEnrollmentMap[cohort.org_id] || 0) + 1;
    });

    const orgLeaderboard = orgs.map(o => ({
      id: o.id,
      name: o.display_name || o.name,
      cohorts: orgCohortMap[o.id] || 0,
      activeParticipants: orgEnrollmentMap[o.id] || 0,
    })).sort((a, b) => b.activeParticipants - a.activeParticipants).slice(0, 8);

    // ── Recent activity (last 30 days) ────────────────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentEnrollments = enrollments.filter(e => e.enrolled_at > thirtyDaysAgo).length;
    const recentSubmissions = assessmentResponses.filter(r => r.submitted_at > thirtyDaysAgo).length;

    res.json({
      data: {
        // Operational
        cohorts: {
          total: cohorts.length,
          by_status: cohortByStatus,
          by_program: cohortByProgram,
          active: cohortByStatus.active || 0,
          draft: cohortByStatus.draft || 0,
          completed: cohortByStatus.completed || 0,
        },
        enrollments: {
          total_active: activeEnrollments,
          total_completed: completedEnrollments,
          in_active_cohorts: enrollmentsInActiveCohorts,
          recent_30d: recentEnrollments,
        },
        content: {
          total_items: contentItems.length,
          published: publishedContent,
          draft: draftContent,
          by_type: contentByType,
          total_assignments: totalContentAssignments,
          completions: completedContentProgress,
          completion_rate_pct: contentCompletionRate,
        },
        assessments: {
          total: assessments.length,
          published: publishedAssessments,
          by_type: assessmentByType,
          total_assignments: totalAssignmentSlots,
          total_submitted: totalSubmitted,
          submission_rate_pct: Math.min(assessmentSubmissionRate, 100),
          recent_submissions_30d: recentSubmissions,
        },
        // Business
        organizations: {
          total_active: orgs.length,
          leaderboard: orgLeaderboard,
        },
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
