import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart2, Users, GraduationCap, BookOpen, FileText,
  TrendingUp, Building2, CheckCircle, Clock, Activity,
  Award, Target, Layers, RefreshCw,
} from 'lucide-react';
import api from '../../lib/api';

const PROGRAM_LABELS = {
  leadership_dev:        'Leadership Dev',
  ac_dc:                 'AC/DC',
  behavioral:            'Behavioral',
  consulting_capability: 'Consulting',
  custom:                'Custom',
};

const CONTENT_TYPE_LABELS = {
  article:            'Article',
  video:              'Video',
  pdf:                'PDF',
  external_link:      'External Link',
  toolkit:            'Toolkit',
  case_study:         'Case Study',
  audio:              'Audio',
  infographic:        'Infographic',
  reflection_prompt:  'Reflection',
  quiz:               'Quiz',
};

const ASSESSMENT_TYPE_LABELS = {
  pre_program:   'Pre-Program',
  post_program:  'Post-Program',
  mid_program:   'Mid-Program',
  competency:    'Competency',
  '360_feedback': '360 Feedback',
  custom:        'Custom',
};

function StatCard({ title, value, subtitle, icon: Icon, color = '#aa78a6', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="glass-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <p className="text-2xl font-bold" style={{ color: '#f0e8fc' }}>
          {value ?? '—'}
        </p>
      </div>
      <p className="text-sm font-medium" style={{ color: '#e0d8f0' }}>{title}</p>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: '#7060a0' }}>{subtitle}</p>}
    </motion.div>
  );
}

function BreakdownBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span style={{ color: '#c0b8d8' }} className="capitalize">{label}</span>
        <span style={{ color: '#7060a0' }}>{value} <span style={{ color: '#4a3860' }}>({pct}%)</span></span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(170,120,166,0.1)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color || '#aa78a6' }}
        />
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  draft: '#b8aad8',
  active: '#40c980',
  completed: '#a898cc',
  archived: '#7a708a',
};

export default function AnalyticsPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics-platform'],
    queryFn: () => api.get('/analytics/platform').then(r => r.data.data),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-48 rounded-lg animate-pulse bg-white/5" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-28 rounded-2xl animate-pulse bg-white/5" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="glass-card p-12 text-center">
        <BarChart2 size={40} className="mx-auto mb-3 opacity-30" style={{ color: '#7060a0' }} />
        <p className="text-sm" style={{ color: '#e05065' }}>Failed to load analytics. Please try again.</p>
        <button onClick={() => refetch()} className="btn-ghost mt-4 text-sm flex items-center gap-2 mx-auto">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    </div>
  );

  const { cohorts, enrollments, content, assessments, organizations } = data || {};

  const totalCohorts = cohorts?.total || 0;
  const totalContentItems = content?.total_items || 0;
  const totalAssessments = assessments?.total || 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 page-enter">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7060a0' }}>Operational and business metrics across the platform</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── Operational KPIs ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#5a4870' }}>
          Operational Metrics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Active Cohorts"        value={cohorts?.active}                  subtitle="Currently running"           icon={GraduationCap} color="#40c980"  delay={0.00} />
          <StatCard title="Active Participants"   value={enrollments?.in_active_cohorts}   subtitle="In active cohorts"           icon={Users}         color="#6496dc"  delay={0.05} />
          <StatCard title="Content Completion"    value={`${content?.completion_rate_pct ?? 0}%`} subtitle={`${content?.completions ?? 0} of ${content?.total_assignments ?? 0} items`} icon={CheckCircle}  color="#aa78a6"  delay={0.10} />
          <StatCard title="Assessment Submissions" value={assessments?.total_submitted}   subtitle="Across all cohorts"          icon={FileText}      color="#f59e0b"  delay={0.15} />
          <StatCard title="Total Cohorts"         value={cohorts?.total}                   subtitle={`${cohorts?.draft ?? 0} draft · ${cohorts?.completed ?? 0} completed`} icon={Layers}     color="#a78bfa"  delay={0.20} />
          <StatCard title="New Enrollments (30d)" value={enrollments?.recent_30d}          subtitle="Last 30 days"                icon={TrendingUp}    color="#34d399"  delay={0.25} />
          <StatCard title="Published Content"     value={content?.published}               subtitle={`${content?.draft ?? 0} in draft`}                icon={BookOpen}      color="#60a5fa"  delay={0.30} />
          <StatCard title="New Submissions (30d)" value={assessments?.recent_submissions_30d} subtitle="Last 30 days"            icon={Activity}      color="#f472b6"  delay={0.35} />
        </div>
      </section>

      {/* ── Breakdown rows ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* Cohort status breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <GraduationCap size={16} style={{ color: '#aa78a6' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#f0e8fc' }}>Cohorts by Status</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(cohorts?.by_status || {}).map(([status, count]) => (
              <BreakdownBar key={status} label={status} value={count} total={totalCohorts} color={STATUS_COLORS[status]} />
            ))}
            {Object.keys(cohorts?.by_status || {}).length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: '#4a3860' }}>No data</p>
            )}
          </div>
        </motion.div>

        {/* Program type breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Award size={16} style={{ color: '#aa78a6' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#f0e8fc' }}>Cohorts by Program Type</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(cohorts?.by_program || {}).map(([type, count]) => (
              <BreakdownBar key={type} label={PROGRAM_LABELS[type] || type} value={count} total={totalCohorts} color="#aa78a6" />
            ))}
            {Object.keys(cohorts?.by_program || {}).length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: '#4a3860' }}>No data</p>
            )}
          </div>
        </motion.div>

        {/* Assessment type breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <FileText size={16} style={{ color: '#aa78a6' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#f0e8fc' }}>Assessments by Type</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(assessments?.by_type || {}).map(([type, count]) => (
              <BreakdownBar key={type} label={ASSESSMENT_TYPE_LABELS[type] || type} value={count} total={totalAssessments} color="#f59e0b" />
            ))}
            {Object.keys(assessments?.by_type || {}).length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: '#4a3860' }}>No data</p>
            )}
          </div>
        </motion.div>

        {/* Content type breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <BookOpen size={16} style={{ color: '#aa78a6' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#f0e8fc' }}>Content by Type</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(content?.by_type || {}).map(([type, count]) => (
              <BreakdownBar key={type} label={CONTENT_TYPE_LABELS[type] || type} value={count} total={totalContentItems} color="#60a5fa" />
            ))}
            {Object.keys(content?.by_type || {}).length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: '#4a3860' }}>No data</p>
            )}
          </div>
        </motion.div>

        {/* Enrollment funnel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Target size={16} style={{ color: '#aa78a6' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#f0e8fc' }}>Enrollment Funnel</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Total Active Enrollments', value: enrollments?.total_active || 0, color: '#6496dc' },
              { label: 'In Active Cohorts',        value: enrollments?.in_active_cohorts || 0, color: '#40c980' },
              { label: 'Completed Enrollments',    value: enrollments?.total_completed || 0, color: '#a78bfa' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(170,120,166,0.05)', border: '1px solid rgba(170,120,166,0.1)' }}>
                <span className="text-sm" style={{ color: '#9080a8' }}>{row.label}</span>
                <span className="text-lg font-bold" style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Library health */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={16} style={{ color: '#aa78a6' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#f0e8fc' }}>Library Health</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Published Content',     value: content?.published || 0,     total: content?.total_items || 0,     color: '#60a5fa' },
              { label: 'Published Assessments', value: assessments?.published || 0, total: assessments?.total || 0,       color: '#f59e0b' },
            ].map(row => (
              <div key={row.label}>
                <BreakdownBar label={row.label} value={row.value} total={row.total || 1} color={row.color} />
                <p className="text-xs mt-0.5 ml-0.5" style={{ color: '#4a3860' }}>
                  {row.value} of {row.total} published
                </p>
              </div>
            ))}
            <div className="pt-2 flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: 'rgba(170,120,166,0.05)', border: '1px solid rgba(170,120,166,0.1)' }}>
              <span className="text-sm" style={{ color: '#9080a8' }}>Content Completion Rate</span>
              <span className="text-lg font-bold" style={{ color: content?.completion_rate_pct >= 60 ? '#40c980' : content?.completion_rate_pct >= 30 ? '#f59e0b' : '#e05065' }}>
                {content?.completion_rate_pct ?? 0}%
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Business Metrics ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#5a4870' }}>
          Business Metrics — Organization Leaderboard
        </h2>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Building2 size={16} style={{ color: '#aa78a6' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#f0e8fc' }}>Top Organizations by Active Participants</h3>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(170,120,166,0.15)', color: '#aa78a6' }}>
              {organizations?.total_active ?? 0} active orgs
            </span>
          </div>
          {!organizations?.leaderboard?.length ? (
            <p className="text-sm text-center py-8" style={{ color: '#4a3860' }}>No organization data</p>
          ) : (
            <div className="space-y-2">
              {organizations.leaderboard.map((org, i) => (
                <div key={org.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.1)' }}>
                  <span className="w-6 text-xs font-bold text-center flex-shrink-0"
                    style={{ color: i < 3 ? '#f59e0b' : '#5a4870' }}>
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#f0e8fc' }}>{org.name}</p>
                    <p className="text-xs" style={{ color: '#7060a0' }}>{org.cohorts} cohort{org.cohorts !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold" style={{ color: '#6496dc' }}>{org.activeParticipants}</p>
                    <p className="text-xs" style={{ color: '#5a4870' }}>participants</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </section>

    </div>
  );
}
