import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Calendar, Activity, GraduationCap,
  MapPin, Video, BookOpen, FileText, Layers, Clock, CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';

const INTERVENTION_ICONS = {
  pre_work:          BookOpen,
  virtual_session:   Video,
  case_study:        FileText,
  study_material:    BookOpen,
  reflection:        Layers,
  group_activity:    Users,
  assessment_window: CheckCircle,
  custom:            MapPin,
};

const INTERVENTION_COLORS = {
  pre_work:          { bg: 'rgba(208,160,48,0.1)',  color: '#d0a030', border: 'rgba(208,160,48,0.2)' },
  virtual_session:   { bg: 'rgba(100,200,120,0.1)', color: '#64c878', border: 'rgba(100,200,120,0.2)' },
  case_study:        { bg: 'rgba(200,100,100,0.1)', color: '#c86464', border: 'rgba(200,100,100,0.2)' },
  study_material:    { bg: 'rgba(90,140,220,0.1)',  color: '#6496dc', border: 'rgba(90,140,220,0.2)' },
  reflection:        { bg: 'rgba(170,120,166,0.1)', color: '#aa78a6', border: 'rgba(170,120,166,0.2)' },
  group_activity:    { bg: 'rgba(100,200,180,0.1)', color: '#64c8b4', border: 'rgba(100,200,180,0.2)' },
  assessment_window: { bg: 'rgba(200,150,80,0.1)',  color: '#c89650', border: 'rgba(200,150,80,0.2)' },
  custom:            { bg: 'rgba(170,120,166,0.06)', color: '#9080a8', border: 'rgba(170,120,166,0.15)' },
};

const STATUS_STYLES = {
  active:    { color: '#64c878' },
  draft:     { color: '#aa78a6' },
  completed: { color: '#6496dc' },
};

const TABS = ['Overview', 'Participants', 'Journey'];

export default function OrgAdminCohortDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');

  const { data: cohort, isLoading: loadingCohort } = useQuery({
    queryKey: ['cohort', id],
    queryFn: () => api.get(`/cohorts/${id}`).then(r => r.data.data),
  });

  const { data: participants = [], isLoading: loadingP } = useQuery({
    queryKey: ['org-cohort-participants', id],
    queryFn: () => api.get(`/org-admin/cohorts/${id}/participants`).then(r => r.data.data),
    enabled: tab === 'Participants',
  });

  const { data: journey, isLoading: loadingJ } = useQuery({
    queryKey: ['journey', id],
    queryFn: () => api.get(`/cohorts/${id}/journey`).then(r => r.data.data),
    enabled: tab === 'Journey',
  });

  if (loadingCohort) return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-64 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 page-enter">
      <button onClick={() => navigate('/org-admin/cohorts')}
        className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: '#7060a0' }}
        onMouseEnter={e => e.currentTarget.style.color = '#e8e0f0'}
        onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
        <ArrowLeft size={16} /> Back to Cohorts
      </button>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-mono mb-1" style={{ color: '#aa78a6' }}>{cohort?.cohort_code}</p>
            <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>{cohort?.name}</h1>
            <p className="mt-1 text-sm" style={{ color: '#7060a0' }}>{cohort?.organizations?.display_name}</p>
          </div>
          <span className="text-sm px-3 py-1.5 rounded-full font-medium capitalize"
            style={{ background: 'rgba(170,120,166,0.1)', border: '1px solid rgba(170,120,166,0.2)', color: STATUS_STYLES[cohort?.status]?.color || '#aa78a6' }}>
            {cohort?.status}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Enrolled',   value: cohort?.enrollment_count ?? 0,   icon: Users    },
            { label: 'Capacity',   value: cohort?.enrollment_capacity ?? '∞', icon: GraduationCap },
            { label: 'Start Date', value: cohort?.start_date ? format(new Date(cohort.start_date), 'MMM d, yyyy') : '—', icon: Calendar },
            { label: 'End Date',   value: cohort?.end_date   ? format(new Date(cohort.end_date),   'MMM d, yyyy') : '—', icon: Calendar },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(170,120,166,0.05)', border: '1px solid rgba(170,120,166,0.12)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={13} style={{ color: '#7060a0' }} />
                <p className="text-xs uppercase tracking-wider" style={{ color: '#7060a0' }}>{label}</p>
              </div>
              <p className="font-semibold" style={{ color: '#f0e8fc' }}>{value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.1)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: tab === t ? 'rgba(170,120,166,0.18)' : 'transparent',
              color: tab === t ? '#f0e8fc' : '#7060a0',
              border: tab === t ? '1px solid rgba(170,120,166,0.3)' : '1px solid transparent',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'Overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 space-y-4">
          <h2 className="font-semibold" style={{ color: '#f0e8fc' }}>Program Details</h2>
          <div className="grid gap-3">
            {[
              { label: 'Program Type', value: cohort?.program_type?.replace(/_/g, ' ') },
              { label: 'Pre-assessment Opens', value: cohort?.pre_assessment_open ? format(new Date(cohort.pre_assessment_open), 'MMM d, yyyy HH:mm') : 'Not set' },
              { label: 'Content Access', value: cohort?.content_access_start ? `${format(new Date(cohort.content_access_start), 'MMM d')} – ${format(new Date(cohort.content_access_end), 'MMM d, yyyy')}` : 'Not set' },
              { label: 'Post-program Access', value: `${cohort?.post_program_access_days || 30} days after completion` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                style={{ background: 'rgba(170,120,166,0.04)', border: '1px solid rgba(170,120,166,0.08)' }}>
                <span className="text-sm" style={{ color: '#7060a0' }}>{label}</span>
                <span className="text-sm font-medium capitalize" style={{ color: '#e0d8f0' }}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Participants Tab */}
      {tab === 'Participants' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#f0e8fc' }}>
              Enrolled Participants <span className="ml-2 text-sm font-normal" style={{ color: '#7060a0' }}>({participants.length})</span>
            </h2>
          </div>
          {loadingP ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-10" style={{ color: '#7060a0' }}>
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p>No participants enrolled yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl"
                  style={{ background: 'rgba(170,120,166,0.04)', border: '1px solid rgba(170,120,166,0.1)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                    style={{ background: 'linear-gradient(135deg, #aa78a6, #3e3264)' }}>
                    {p.users?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#f0e8fc' }}>{p.users?.name}</p>
                    <p className="text-xs" style={{ color: '#7060a0' }}>
                      {p.users?.designation || p.users?.email}
                      {p.users?.department ? ` · ${p.users.department}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(100,200,120,0.1)', color: '#64c878', border: '1px solid rgba(100,200,120,0.2)' }}>
                      {p.status}
                    </span>
                    {p.users?.last_login_at && (
                      <p className="text-xs mt-1" style={{ color: '#5a4870' }}>
                        Last active {format(new Date(p.users.last_login_at), 'MMM d')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Journey Tab */}
      {tab === 'Journey' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {loadingJ ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : !journey || !journey.interventions?.length ? (
            <div className="glass-card p-12 text-center">
              <Layers size={40} className="mx-auto mb-3" style={{ color: '#3e2860' }} />
              <p style={{ color: '#7060a0' }}>The learning journey has not been configured yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="glass-card p-4 mb-4">
                <h2 className="font-semibold" style={{ color: '#f0e8fc' }}>{journey.name}</h2>
                {journey.description && <p className="text-sm mt-1" style={{ color: '#7060a0' }}>{journey.description}</p>}
              </div>
              {journey.interventions.map((iv, i) => {
                const Icon = INTERVENTION_ICONS[iv.intervention_type] || MapPin;
                const style = INTERVENTION_COLORS[iv.intervention_type] || INTERVENTION_COLORS.custom;
                return (
                  <motion.div key={iv.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-4 flex gap-4 items-start">
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                        <Icon size={17} style={{ color: style.color }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: '#5a4870' }}>{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="font-medium" style={{ color: '#f0e8fc' }}>{iv.title}</h3>
                          <span className="text-xs capitalize" style={{ color: style.color }}>
                            {iv.intervention_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {iv.scheduled_date && (
                          <div className="flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: '#7060a0' }}>
                            <Calendar size={12} />
                            {format(new Date(iv.scheduled_date), 'MMM d, yyyy')}
                            {iv.scheduled_time && ` · ${iv.scheduled_time.slice(0, 5)}`}
                          </div>
                        )}
                      </div>
                      {iv.description && (
                        <p className="text-sm mt-2" style={{ color: '#9080a8' }}>{iv.description}</p>
                      )}
                      {iv.duration_minutes && (
                        <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: '#7060a0' }}>
                          <Clock size={11} /> {iv.duration_minutes} min
                        </div>
                      )}
                      {iv.virtual_session_link && (
                        <div className="mt-3">
                          <a href={iv.virtual_session_link} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                            style={{ background: 'rgba(100,200,120,0.1)', color: '#64c878', border: '1px solid rgba(100,200,120,0.25)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,200,120,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,200,120,0.1)'}>
                            <Video size={12} /> Join Session
                            {iv.virtual_session_platform && ` via ${iv.virtual_session_platform}`}
                          </a>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
