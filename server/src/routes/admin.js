const express = require('express');
const supabase = require('../config/supabase');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN));

// ── GET /admin/dashboard — KPI cards ─────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      { count: activeOrgs },
      { count: activeCohorts },
      { data: participantStats },
      { count: pendingReview },
      { data: expiringCohorts },
    ] = await Promise.all([
      supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
      supabase.from('cohorts').select('*', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
      supabase.from('users').select('status').eq('role', 'PARTICIPANT').is('deleted_at', null),
      supabase.from('assessment_responses').select('*', { count: 'exact', head: true }).eq('status', 'submitted').is('manual_score', null).is('scored_at', null),
      supabase.from('cohorts').select('id,name,end_date,health_label').eq('status', 'active').lte('end_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).is('deleted_at', null),
    ]);

    // Participant status breakdown
    const byStatus = (participantStats || []).reduce((acc, u) => { acc[u.status] = (acc[u.status] || 0) + 1; return acc; }, {});

    // Inactivity alerts (7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: inactiveCount } = await supabase
      .from('users').select('*', { count: 'exact', head: true })
      .eq('role', 'PARTICIPANT').lt('last_login_at', sevenDaysAgo).is('deleted_at', null);

    const platformAlerts = (inactiveCount || 0) + (expiringCohorts?.length || 0);

    res.json({
      data: {
        kpi: {
          active_organizations: activeOrgs,
          active_cohorts: activeCohorts,
          participants: { total: (participantStats || []).length, by_status: byStatus },
          assessments_pending_review: pendingReview,
          platform_alerts: platformAlerts,
        },
        alerts_detail: {
          inactive_participants: inactiveCount,
          expiring_cohorts: expiringCohorts,
        }
      }
    });
  } catch (err) { next(err); }
});

// ── GET /admin/cohort-health-board ────────────────────────────────────────────
router.get('/cohort-health-board', async (req, res, next) => {
  try {
    const { org_id, program_type, health_label } = req.query;

    let query = supabase.from('cohorts')
      .select(`id,name,program_type,status,start_date,end_date,health_score,health_label,enrollment_capacity,
        organizations(id,name,display_name,logo_url)`)
      .eq('status', 'active').is('deleted_at', null)
      .order('health_label', { ascending: true });

    if (org_id) query = query.eq('org_id', org_id);
    if (program_type) query = query.eq('program_type', program_type);
    if (health_label) query = query.eq('health_label', health_label);

    const { data: cohorts, error } = await query;
    if (error) throw error;

    // Enrich with enrollment counts
    const enriched = await Promise.all((cohorts || []).map(async (c) => {
      const { count } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('cohort_id', c.id).eq('status', 'active');
      return { ...c, enrollment_count: count };
    }));

    // Sort: red → amber → green → grey
    const order = { red: 0, amber: 1, green: 2, grey: 3 };
    enriched.sort((a, b) => (order[a.health_label] || 3) - (order[b.health_label] || 3));

    res.json({ data: enriched });
  } catch (err) { next(err); }
});

// ── GET /admin/activity-feed ──────────────────────────────────────────────────
router.get('/activity-feed', async (req, res, next) => {
  try {
    const { page = 1, event_type } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = supabase.from('audit_logs')
      .select('*', { count: 'exact' })
      .in('action_type', [
        'user.first_login', 'assessment_response.submitted', 'content_item.created',
        'user.login', 'report.exported', 'system.inactivity_alert', 'cohort.launched',
        'organization.created', 'cohort.created',
      ])
      .order('created_at', { ascending: false });

    if (event_type) query = query.eq('action_type', event_type);
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, meta: { total: count, page: +page, limit } });
  } catch (err) { next(err); }
});

module.exports = router;
