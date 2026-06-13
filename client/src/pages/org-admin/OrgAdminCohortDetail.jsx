import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, Calendar, GraduationCap,
  MapPin, Video, BookOpen, FileText, Layers, Clock, CheckCircle,
  Brain, Target, Star, Sliders, ExternalLink, Headphones, Package, Globe,
  Plus, Trash2, Search, X, Check, AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import api from '../../lib/api';

const INTERVENTION_ICONS = {
  pre_work: BookOpen, virtual_session: Video, case_study: FileText,
  study_material: BookOpen, reflection: Layers, group_activity: Users,
  assessment_window: CheckCircle, custom: MapPin,
};
const INTERVENTION_COLORS = {
  pre_work:          { bg: 'rgba(208,160,48,0.1)',  color: '#d0a030', border: 'rgba(208,160,48,0.2)'  },
  virtual_session:   { bg: 'rgba(100,200,120,0.1)', color: '#64c878', border: 'rgba(100,200,120,0.2)' },
  case_study:        { bg: 'rgba(200,100,100,0.1)', color: '#c86464', border: 'rgba(200,100,100,0.2)' },
  study_material:    { bg: 'rgba(90,140,220,0.1)',  color: '#6496dc', border: 'rgba(90,140,220,0.2)'  },
  reflection:        { bg: 'rgba(170,120,166,0.1)', color: '#aa78a6', border: 'rgba(170,120,166,0.2)' },
  group_activity:    { bg: 'rgba(100,200,180,0.1)', color: '#64c8b4', border: 'rgba(100,200,180,0.2)' },
  assessment_window: { bg: 'rgba(200,150,80,0.1)',  color: '#c89650', border: 'rgba(200,150,80,0.2)'  },
  custom:            { bg: 'rgba(170,120,166,0.06)', color: '#9080a8', border: 'rgba(170,120,166,0.15)'},
};
const STATUS_STYLES = {
  active: { color: '#64c878' }, draft: { color: '#aa78a6' }, completed: { color: '#6496dc' },
};
const ASSESSMENT_TYPE_MAP = {
  personality:      { label: 'Personality',     color: '#aa78a6', bg: 'rgba(170,120,166,0.12)', icon: Brain    },
  behavioral:       { label: 'Behavioral',      color: '#6496dc', bg: 'rgba(100,150,220,0.12)', icon: Target   },
  leadership_style: { label: 'Leadership',      color: '#c89650', bg: 'rgba(200,150,80,0.12)',  icon: Star     },
  psychometric:     { label: 'Psychometric',    color: '#64c8b4', bg: 'rgba(100,200,180,0.12)', icon: Sliders  },
  knowledge_check:  { label: 'Knowledge Check', color: '#c86464', bg: 'rgba(200,100,100,0.12)', icon: BookOpen },
};
const CONTENT_TYPE_MAP = {
  article:           { label: 'Article',      color: '#6496dc', bg: 'rgba(100,150,220,0.12)', icon: FileText   },
  video:             { label: 'Video',         color: '#40c980', bg: 'rgba(64,201,128,0.12)',  icon: Video      },
  case_study:        { label: 'Case Study',    color: '#c89650', bg: 'rgba(200,150,80,0.12)',  icon: Star       },
  presentation:      { label: 'Presentation', color: '#aa78a6', bg: 'rgba(170,120,166,0.12)', icon: Layers     },
  toolkit:           { label: 'Toolkit',       color: '#64c8b4', bg: 'rgba(100,200,180,0.12)', icon: Package    },
  external_link:     { label: 'Link',          color: '#c86464', bg: 'rgba(200,100,100,0.12)', icon: Globe      },
  audio:             { label: 'Audio',         color: '#c8a0c4', bg: 'rgba(200,160,196,0.12)', icon: Headphones },
  reflection_prompt: { label: 'Reflection',   color: '#d0a030', bg: 'rgba(208,160,48,0.12)',  icon: BookOpen   },
};

const TABS = ['Overview', 'Participants', 'Journey', 'Assessments', 'Content'];

// ── Enroll Modal ──────────────────────────────────────────────────────────────
function OrgEnrollModal({ allParticipants, enrolledIds, onEnroll, onClose, loading, error }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const filtered = allParticipants.filter(p => {
    if (enrolledIds.has(p.id)) return false;
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
  });

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 9999, background: 'rgba(8,8,18,0.82)', backdropFilter: 'blur(6px)' }}>
      <div className="flex min-h-full items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onClose()}>
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
          className="w-full max-w-lg rounded-2xl p-6"
          style={{ background: '#140e24', border: '1px solid rgba(170,120,166,0.25)' }}
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: '#f0e8fc' }}>Enroll Participants</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#7060a0' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
              onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
              <X size={16} />
            </button>
          </div>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7060a0' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }}
              onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.2)'} />
          </div>
          <div className="overflow-y-auto space-y-1 mb-3" style={{ maxHeight: '300px' }}>
            {filtered.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: '#5a4870' }}>
                {allParticipants.length === 0 ? 'Loading participants…' : 'No participants available'}
              </p>
            ) : filtered.map(p => {
              const isSel = selected.includes(p.id);
              return (
                <div key={p.id} onClick={() => toggle(p.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                  style={{ background: isSel ? 'rgba(100,150,220,0.12)' : 'transparent', border: `1px solid ${isSel ? 'rgba(100,150,220,0.3)' : 'transparent'}` }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: isSel ? 'rgba(100,150,220,0.3)' : 'rgba(170,120,166,0.2)', color: isSel ? '#6496dc' : '#aa78a6' }}>
                    {isSel ? <Check size={13} /> : p.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#f0e8fc' }}>{p.name}</p>
                    <p className="text-xs truncate" style={{ color: '#7060a0' }}>{p.email}{p.designation ? ` · ${p.designation}` : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
              style={{ background: 'rgba(224,80,101,0.12)', border: '1px solid rgba(224,80,101,0.25)', color: '#e05065' }}>
              <AlertCircle size={14} className="flex-shrink-0" />{error}
            </div>
          )}
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(170,120,166,0.12)' }}>
            <p className="text-sm" style={{ color: '#7060a0' }}>{selected.length > 0 ? `${selected.length} selected` : 'Click to select'}</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm" style={{ color: '#9080a8' }}>Cancel</button>
              <button disabled={!selected.length || loading} onClick={() => onEnroll(selected)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: 'rgba(100,150,220,0.2)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.3)' }}>
                {loading ? 'Enrolling…' : `Enroll ${selected.length || ''}`}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>,
    document.body
  );
}

export default function OrgAdminCohortDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  const { data: cohort, isLoading: loadingCohort } = useQuery({
    queryKey: ['cohort', id],
    queryFn: () => api.get(`/cohorts/${id}`).then(r => r.data.data),
  });

  const { data: participants = [], isLoading: loadingP, isError: participantsError } = useQuery({
    queryKey: ['org-cohort-participants', id],
    queryFn: () => api.get(`/org-admin/cohorts/${id}/participants`).then(r => r.data.data),
    enabled: tab === 'Participants',
    retry: 1,
  });

  const { data: journey, isLoading: loadingJ } = useQuery({
    queryKey: ['journey', id],
    queryFn: () => api.get(`/cohorts/${id}/journey`).then(r => r.data.data),
    enabled: tab === 'Journey',
  });

  const { data: assessmentsData = [], isLoading: loadingA } = useQuery({
    queryKey: ['org-cohort-assessments', id],
    queryFn: () => api.get(`/org-admin/cohorts/${id}/assessments`).then(r => r.data.data),
    enabled: tab === 'Assessments',
  });

  const { data: contentData = [], isLoading: loadingC } = useQuery({
    queryKey: ['org-cohort-content', id],
    queryFn: () => api.get(`/org-admin/cohorts/${id}/content`).then(r => r.data.data),
    enabled: tab === 'Content',
  });

  const { data: allParticipants = [] } = useQuery({
    queryKey: ['users-participants'],
    queryFn: () => api.get('/users', { params: { role: 'PARTICIPANT', limit: 200 } }).then(r => r.data.data),
    enabled: showEnrollModal,
  });

  const enrollMutation = useMutation({
    mutationFn: (ids) => api.post(`/cohorts/${id}/enrollments/bulk`, { participant_ids: ids }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['org-cohort-participants', id] });
      const d = res.data;
      if (d?.enrolled > 0) { setShowEnrollModal(false); setEnrollError(''); }
      else setEnrollError(d?.errors?.[0]?.error || 'No participants were enrolled');
    },
    onError: (err) => setEnrollError(err.response?.data?.error?.message || 'Enrollment failed'),
  });

  const removeEnrollMutation = useMutation({
    mutationFn: (enrollId) => api.delete(`/cohorts/${id}/enrollments/${enrollId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-cohort-participants', id] }),
    onError: (err) => alert(err.response?.data?.error?.message || 'Failed to remove participant'),
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
            { label: 'Enrolled',   value: cohort?.enrollment_count ?? 0,      icon: Users        },
            { label: 'Capacity',   value: cohort?.enrollment_capacity ?? '∞', icon: GraduationCap },
            { label: 'Start Date', value: cohort?.start_date ? format(parseISO(cohort.start_date), 'MMM d, yyyy') : '—', icon: Calendar },
            { label: 'End Date',   value: cohort?.end_date   ? format(parseISO(cohort.end_date),   'MMM d, yyyy') : '—', icon: Calendar },
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
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.1)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap"
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
          <div className="flex items-center gap-3 mb-4">
            <Users size={18} style={{ color: '#aa78a6' }} />
            <h2 className="font-semibold flex-1" style={{ color: '#f0e8fc' }}>
              Enrolled Participants
              <span className="ml-2 text-sm font-normal" style={{ color: '#7060a0' }}>({participants.length})</span>
            </h2>
            <button onClick={() => { setShowEnrollModal(true); setEnrollError(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(100,150,220,0.15)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.3)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,150,220,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,150,220,0.15)'}>
              <Plus size={14} /> Enroll Participants
            </button>
          </div>
          {loadingP ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : participantsError ? (
            <div className="text-center py-10 flex flex-col items-center gap-2" style={{ color: '#e05065' }}>
              <AlertCircle size={28} className="opacity-60" />
              <p className="text-sm">Failed to load participants. Please restart the server and refresh.</p>
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-10" style={{ color: '#7060a0' }}>
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p>No participants enrolled yet.</p>
              <p className="text-xs mt-1">Click "Enroll Participants" to add people to this cohort.</p>
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
                      {p.users?.email}
                      {p.users?.designation ? ` · ${p.users.designation}` : ''}
                      {p.users?.department ? ` · ${p.users.department}` : ''}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(100,200,120,0.1)', color: '#64c878', border: '1px solid rgba(100,200,120,0.2)' }}>
                    {p.status}
                  </span>
                  <button
                    onClick={() => { if (confirm(`Remove ${p.users?.name} from this cohort?`)) removeEnrollMutation.mutate(p.id); }}
                    className="p-1.5 rounded-lg transition-colors flex-shrink-0" style={{ color: '#9080a8' }}
                    onMouseEnter={ev => { ev.currentTarget.style.color = '#e05065'; ev.currentTarget.style.background = 'rgba(224,80,101,0.1)'; }}
                    onMouseLeave={ev => { ev.currentTarget.style.color = '#9080a8'; ev.currentTarget.style.background = ''; }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Enroll Modal */}
      <AnimatePresence>
        {showEnrollModal && (
          <OrgEnrollModal
            allParticipants={allParticipants}
            enrolledIds={new Set(participants.map(p => p.participant_id))}
            onEnroll={(ids) => enrollMutation.mutate(ids)}
            onClose={() => { setShowEnrollModal(false); setEnrollError(''); }}
            loading={enrollMutation.isPending}
            error={enrollError}
          />
        )}
      </AnimatePresence>

      {/* Assessments Tab */}
      {tab === 'Assessments' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="glass-card p-4 flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: '#f0e8fc' }}>Assigned Assessments</h2>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(170,120,166,0.1)', color: '#aa78a6' }}>
              {assessmentsData.length} assigned
            </span>
          </div>
          {loadingA ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : !assessmentsData.length ? (
            <div className="glass-card p-12 text-center">
              <Brain size={36} className="mx-auto mb-3 opacity-20" style={{ color: '#aa78a6' }} />
              <p style={{ color: '#7060a0' }}>No assessments assigned to this cohort yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assessmentsData.map((asg, i) => {
                const a = asg.assessments;
                if (!a) return null;
                const t = ASSESSMENT_TYPE_MAP[a.assessment_type] || ASSESSMENT_TYPE_MAP.knowledge_check;
                const Icon = t.icon;
                const totalQs = (a.sections || []).reduce((s, sec) => s + (sec.questions?.length || 0), 0);
                return (
                  <motion.div key={asg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="glass-card p-4 flex items-start gap-4"
                    style={{ border: '1px solid rgba(170,120,166,0.1)' }}>
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ background: t.bg, border: `1px solid ${t.color}33` }}>
                      <Icon size={16} style={{ color: t.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="font-medium text-sm" style={{ color: '#f0e8fc' }}>{a.title}</h3>
                          {a.description && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#7060a0' }}>{a.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: t.bg, color: t.color, border: `1px solid ${t.color}33` }}>{t.label}</span>
                          {asg.mandatory && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(200,150,80,0.1)', color: '#c89650', border: '1px solid rgba(200,150,80,0.2)' }}>
                              Required
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: '#6a5880' }}>
                        <span>{(a.sections || []).length} sections · {totalQs} questions</span>
                        {a.timer_minutes && <span className="flex items-center gap-1"><Clock size={11} /> {a.timer_minutes}m</span>}
                        {asg.access_open && <span>Opens {format(new Date(asg.access_open), 'MMM d')}</span>}
                        {asg.access_close && <span>Closes {format(new Date(asg.access_close), 'MMM d')}</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Content Tab */}
      {tab === 'Content' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="glass-card p-4 flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: '#f0e8fc' }}>Assigned Content</h2>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(170,120,166,0.1)', color: '#aa78a6' }}>
              {contentData.length} items
            </span>
          </div>
          {loadingC ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : !contentData.length ? (
            <div className="glass-card p-12 text-center">
              <BookOpen size={36} className="mx-auto mb-3 opacity-20" style={{ color: '#aa78a6' }} />
              <p style={{ color: '#7060a0' }}>No content assigned to this cohort yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contentData.map((ca, i) => {
                const c = ca.content_items;
                if (!c) return null;
                const t = CONTENT_TYPE_MAP[c.content_type] || CONTENT_TYPE_MAP.article;
                const Icon = t.icon;
                return (
                  <motion.div key={ca.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="glass-card p-4 flex items-center gap-4"
                    style={{ border: '1px solid rgba(170,120,166,0.1)' }}>
                    <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(170,120,166,0.1)', color: '#7060a0' }}>
                      {i + 1}
                    </div>
                    <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ background: t.bg, border: `1px solid ${t.color}33` }}>
                      <Icon size={14} style={{ color: t.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm" style={{ color: '#f0e8fc' }}>{c.title}</h3>
                      <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: '#6a5880' }}>
                        <span style={{ color: t.color }}>{t.label}</span>
                        {ca.module_name && ca.module_name !== 'General' && <span>{ca.module_name}</span>}
                        {c.estimated_minutes && <span className="flex items-center gap-1"><Clock size={10} /> {c.estimated_minutes}m</span>}
                      </div>
                    </div>
                    {ca.mandatory && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(200,150,80,0.1)', color: '#c89650', border: '1px solid rgba(200,150,80,0.2)' }}>
                        Required
                      </span>
                    )}
                    {(c.external_url || c.file_url) && (
                      <a href={c.external_url || c.file_url} target="_blank" rel="noreferrer"
                        className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
                        style={{ color: '#7060a0' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#c8a0c4'}
                        onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </motion.div>
                );
              })}
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
          ) : !journey?.interventions?.length ? (
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
                            {format(parseISO(iv.scheduled_date), 'MMM d, yyyy')}
                            {iv.scheduled_time && ` · ${iv.scheduled_time.slice(0, 5)}`}
                          </div>
                        )}
                      </div>
                      {iv.description && <p className="text-sm mt-2" style={{ color: '#9080a8' }}>{iv.description}</p>}
                      {iv.duration_minutes && (
                        <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: '#7060a0' }}>
                          <Clock size={11} /> {iv.duration_minutes} min
                        </div>
                      )}
                      {iv.virtual_session_link && (
                        <div className="mt-3">
                          <a href={iv.virtual_session_link} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ background: 'rgba(100,200,120,0.1)', color: '#64c878', border: '1px solid rgba(100,200,120,0.25)' }}>
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
