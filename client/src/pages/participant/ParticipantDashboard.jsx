import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GraduationCap, Calendar, ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const STATUS_STYLES = {
  active:    { bg: 'rgba(100,200,120,0.12)', color: '#64c878', border: 'rgba(100,200,120,0.25)' },
  draft:     { bg: 'rgba(170,120,166,0.1)',  color: '#aa78a6', border: 'rgba(170,120,166,0.2)' },
  completed: { bg: 'rgba(90,140,220,0.1)',   color: '#6496dc', border: 'rgba(90,140,220,0.2)' },
};

const PROG_LABELS = {
  leadership_dev: 'Leadership Dev', ac_dc: 'AC / DC', behavioral: 'Behavioral',
  consulting_capability: 'Consulting', custom: 'Custom',
};

const PROG_GRADIENTS = {
  leadership_dev: 'linear-gradient(135deg, #aa78a6 0%, #7a5090 100%)',
  ac_dc:          'linear-gradient(135deg, #d0a030 0%, #a06820 100%)',
  behavioral:     'linear-gradient(135deg, #64c878 0%, #3a8050 100%)',
  consulting_capability: 'linear-gradient(135deg, #6496dc 0%, #3a5090 100%)',
  custom:         'linear-gradient(135deg, #9080a8 0%, #503870 100%)',
};

export default function ParticipantDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: cohorts = [], isLoading } = useQuery({
    queryKey: ['participant-cohorts'],
    queryFn: () => api.get('/participant/cohorts').then(r => r.data.data),
  });

  const active = cohorts.filter(c => c.status === 'active');
  const others = cohorts.filter(c => c.status !== 'active');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 page-enter">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6496dc, #3e3264)' }}>
            {user?.name?.[0] || 'P'}
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>
              Welcome back, {user?.name?.split(' ')[0] || 'Learner'}!
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>
              {user?.designation ? `${user.designation} · ` : ''}{user?.department || ''}
            </p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 text-sm" style={{ color: '#aa78a6' }}>
            <Sparkles size={16} />
            <span>{active.length} active program{active.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </motion.div>

      {/* Active Programs */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2].map(i => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : active.length === 0 && others.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <GraduationCap size={48} className="mx-auto mb-4" style={{ color: '#3e2860' }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>No programs yet</h2>
          <p style={{ color: 'var(--text-faint)' }}>You haven't been enrolled in any learning program yet.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#64c878', boxShadow: '0 0 8px #64c87880' }} />
                Active Programs
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {active.map((cohort, i) => (
                  <motion.div key={cohort.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => navigate(`/participant/cohorts/${cohort.id}`)}
                    className="glass-card overflow-hidden cursor-pointer group"
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.4)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.16)'}>
                    {/* Gradient header */}
                    <div className="h-2" style={{ background: PROG_GRADIENTS[cohort.program_type] || PROG_GRADIENTS.custom }} />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-faint)' }}>{cohort.cohort_code}</p>
                          <h3 className="font-semibold leading-tight" style={{ color: 'var(--text-heading)' }}>{cohort.name}</h3>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{cohort.organizations?.display_name}</p>
                        </div>
                        <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ ...STATUS_STYLES.active }}>
                          Active
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs mb-4" style={{ color: 'var(--text-faint)' }}>
                        <span className="px-2 py-0.5 rounded-md" style={{ background: 'rgba(170,120,166,0.08)' }}>
                          {PROG_LABELS[cohort.program_type] || cohort.program_type}
                        </span>
                        {cohort.end_date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            Ends {format(new Date(cohort.end_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>

                      <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group-hover:gap-3"
                        style={{ background: 'rgba(100,150,220,0.12)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.25)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,150,220,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,150,220,0.12)'}>
                        <BookOpen size={14} /> Enter Learning Space <ArrowRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-faint)' }}>Past Programs</h2>
              <div className="space-y-2">
                {others.map(cohort => (
                  <div key={cohort.id}
                    onClick={() => navigate(`/participant/cohorts/${cohort.id}`)}
                    className="glass-card p-4 flex items-center gap-4 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.16)'}>
                    <GraduationCap size={18} className="flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: '#e0d8f0' }}>{cohort.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{PROG_LABELS[cohort.program_type]}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ ...(STATUS_STYLES[cohort.status] || {}) }}>
                      {cohort.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
