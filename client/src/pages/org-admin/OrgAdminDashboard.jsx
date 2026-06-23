import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GraduationCap, Users, Calendar, Activity, ArrowRight, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const STATUS_STYLES = {
  active:    { bg: 'rgba(100,200,120,0.12)', color: '#64c878', border: 'rgba(100,200,120,0.25)' },
  draft:     { bg: 'rgba(170,120,166,0.1)',  color: '#aa78a6', border: 'rgba(170,120,166,0.2)' },
  completed: { bg: 'rgba(90,140,220,0.1)',   color: '#6496dc', border: 'rgba(90,140,220,0.2)' },
};

const PROG_LABELS = {
  leadership_dev: 'Leadership Dev',
  ac_dc: 'AC / DC',
  behavioral: 'Behavioral',
  consulting_capability: 'Consulting',
  custom: 'Custom',
};

export default function OrgAdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: cohorts = [], isLoading } = useQuery({
    queryKey: ['org-admin-cohorts'],
    queryFn: () => api.get('/org-admin/cohorts').then(r => r.data.data),
  });

  const active = cohorts.filter(c => c.status === 'active');
  const upcoming = cohorts.filter(c => c.status === 'draft');
  const totalParticipants = cohorts.reduce((s, c) => s + (c.enrollment_count || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 page-enter">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-glow" style={{ color: 'var(--text-heading)' }}>
          Welcome back, {user?.name?.split(' ')[0] || 'Admin'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-faint)' }}>
          Here's an overview of your organization's active programs.
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Cohorts',     value: active.length,        icon: Activity,      color: '#64c878' },
          { label: 'Total Participants', value: totalParticipants,    icon: Users,         color: '#aa78a6' },
          { label: 'Upcoming',           value: upcoming.length,      icon: Calendar,      color: '#d0a030' },
          { label: 'Total Programs',     value: cohorts.length,       icon: GraduationCap, color: '#6496dc' },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon size={15} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Active Cohorts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
            <TrendingUp size={18} style={{ color: '#aa78a6' }} /> Active Cohorts
          </h2>
          <button onClick={() => navigate('/org-admin/cohorts')}
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#aa78a6'}
            onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
            View all <ArrowRight size={12} />
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1,2].map(i => <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
          </div>
        ) : active.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <GraduationCap size={40} className="mx-auto mb-3" style={{ color: '#3e2860' }} />
            <p style={{ color: 'var(--text-faint)' }}>No active cohorts at the moment.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((cohort, i) => (
              <motion.div key={cohort.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => navigate(`/org-admin/cohorts/${cohort.id}`)}
                className="glass-card p-5 cursor-pointer group transition-all duration-200"
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.16)'}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-faint)' }}>{cohort.cohort_code}</p>
                    <h3 className="font-semibold leading-tight" style={{ color: 'var(--text-heading)' }}>{cohort.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{PROG_LABELS[cohort.program_type] || cohort.program_type}</p>
                  </div>
                  <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium capitalize"
                    style={{ ...STATUS_STYLES[cohort.status] }}>
                    {cohort.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg p-2" style={{ background: 'rgba(170,120,166,0.06)' }}>
                    <p className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>{cohort.enrollment_count}</p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Participants</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: 'rgba(170,120,166,0.06)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-heading)' }}>
                      {cohort.start_date ? format(new Date(cohort.start_date), 'MMM d') : '—'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Start</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: 'rgba(170,120,166,0.06)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-heading)' }}>
                      {cohort.end_date ? format(new Date(cohort.end_date), 'MMM d') : '—'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>End</p>
                  </div>
                </div>
                <div className="flex items-center justify-end mt-3 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#aa78a6' }}>
                  <span className="text-xs">View details</span>
                  <ArrowRight size={12} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
