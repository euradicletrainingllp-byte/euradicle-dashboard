import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, Calendar, Activity, BarChart2, Rocket, CheckCircle,
  Plus, Trash2, GripVertical, Edit2, Save, X, Video, BookOpen, FileText,
  Layers, MapPin, Clock, Link as LinkIcon, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';

// ── Constants ────────────────────────────────────────────────────────────────
const INTERVENTION_TYPES = [
  { value: 'pre_work',          label: 'Pre-Work',        icon: BookOpen,    color: '#d0a030' },
  { value: 'virtual_session',   label: 'Virtual Session', icon: Video,       color: '#64c878' },
  { value: 'case_study',        label: 'Case Study',      icon: FileText,    color: '#c86464' },
  { value: 'study_material',    label: 'Study Material',  icon: BookOpen,    color: '#6496dc' },
  { value: 'reflection',        label: 'Reflection',      icon: Layers,      color: '#aa78a6' },
  { value: 'group_activity',    label: 'Group Activity',  icon: Users,       color: '#64c8b4' },
  { value: 'assessment_window', label: 'Assessment',      icon: CheckCircle, color: '#c89650' },
  { value: 'custom',            label: 'Custom',          icon: MapPin,      color: '#9080a8' },
];

const TYPE_MAP = Object.fromEntries(INTERVENTION_TYPES.map(t => [t.value, t]));

const TABS = ['Overview', 'Journey', 'Analytics'];

// ── Intervention Form ────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', intervention_type: 'virtual_session', description: '', facilitator_notes: '',
  scheduled_date: '', scheduled_time: '', duration_minutes: '',
  virtual_session_link: '', virtual_session_platform: '', is_mandatory: true, status: 'published',
};

function InterventionForm({ initial = EMPTY_FORM, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedType = TYPE_MAP[form.intervention_type] || INTERVENTION_TYPES[0];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(170,120,166,0.06)', border: '1px solid rgba(170,120,166,0.2)' }}>
      {/* Type selector */}
      <div className="grid grid-cols-4 gap-2">
        {INTERVENTION_TYPES.map(t => (
          <button key={t.value} onClick={() => set('intervention_type', t.value)}
            className="flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs font-medium transition-all duration-150"
            style={{
              background: form.intervention_type === t.value ? `${t.color}1a` : 'rgba(255,255,255,0.03)',
              border: form.intervention_type === t.value ? `1px solid ${t.color}50` : '1px solid rgba(170,120,166,0.1)',
              color: form.intervention_type === t.value ? t.color : '#7060a0',
            }}>
            <t.icon size={16} />
            <span className="text-center leading-tight">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Title *</label>
        <input value={form.title} onChange={e => set('title', e.target.value)}
          placeholder={`e.g., ${selectedType.label} #1`}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }} />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          rows={2} placeholder="What participants will do or learn…"
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }} />
      </div>

      {/* Date + Time + Duration in a row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Date</label>
          <input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc', colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Time</label>
          <input type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc', colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Duration (min)</label>
          <input type="number" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)}
            placeholder="60"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }} />
        </div>
      </div>

      {/* Virtual session link */}
      {(form.intervention_type === 'virtual_session') && (
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Session Link</label>
            <input value={form.virtual_session_link} onChange={e => set('virtual_session_link', e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }} />
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Platform</label>
            <input value={form.virtual_session_platform} onChange={e => set('virtual_session_platform', e.target.value)}
              placeholder="Zoom / Teams…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }} />
          </div>
        </div>
      )}

      {/* Advanced */}
      <button onClick={() => setShowAdvanced(s => !s)}
        className="flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: '#7060a0' }}
        onMouseEnter={e => e.currentTarget.style.color = '#aa78a6'}
        onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
        {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        Advanced options
      </button>

      {showAdvanced && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="space-y-3">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Facilitator Notes (private)</label>
            <textarea value={form.facilitator_notes} onChange={e => set('facilitator_notes', e.target.value)}
              rows={2} placeholder="Notes visible only to admins…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }} />
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_mandatory} onChange={e => set('is_mandatory', e.target.checked)}
                className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: '#c0b8d8' }}>Mandatory</span>
            </label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs outline-none ml-4"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm transition-all"
          style={{ color: '#7060a0', border: '1px solid rgba(170,120,166,0.18)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
          onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
          Cancel
        </button>
        <button onClick={() => onSave(form)} disabled={!form.title || isSaving}
          className="btn-primary flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50">
          <Save size={14} /> {isSaving ? 'Saving…' : 'Save Intervention'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Intervention Row ─────────────────────────────────────────────────────────
function InterventionRow({ iv, index, onEdit, onDelete, provided }) {
  const typeInfo = TYPE_MAP[iv.intervention_type] || INTERVENTION_TYPES[INTERVENTION_TYPES.length - 1];
  const Icon = typeInfo.icon;

  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl group"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.12)' }}>
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <span className="text-xs font-bold w-5 text-right" style={{ color: '#5a4870' }}>{index + 1}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${typeInfo.color}1a`, border: `1px solid ${typeInfo.color}40` }}>
          <Icon size={15} style={{ color: typeInfo.color }} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm" style={{ color: '#f0e8fc' }}>{iv.title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${typeInfo.color}18`, color: typeInfo.color }}>
            {typeInfo.label}
          </span>
          {iv.status === 'draft' && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(170,120,166,0.1)', color: '#7060a0' }}>
              Draft
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-1.5 text-xs" style={{ color: '#7060a0' }}>
          {iv.scheduled_date && (
            <span className="flex items-center gap-1"><Calendar size={11} />
              {format(new Date(iv.scheduled_date), 'MMM d, yyyy')}
              {iv.scheduled_time ? ` · ${iv.scheduled_time.slice(0,5)}` : ''}
            </span>
          )}
          {iv.duration_minutes && (
            <span className="flex items-center gap-1"><Clock size={11} />{iv.duration_minutes}m</span>
          )}
          {iv.virtual_session_link && (
            <span className="flex items-center gap-1 truncate max-w-48" title={iv.virtual_session_link}>
              <LinkIcon size={11} />{iv.virtual_session_platform || 'Session link set'}
            </span>
          )}
          {iv.is_mandatory && (
            <span style={{ color: '#c89650' }}>Required</span>
          )}
        </div>
        {iv.description && (
          <p className="text-xs mt-1.5 line-clamp-2" style={{ color: '#7060a0' }}>{iv.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onEdit(iv)}
          className="p-1.5 rounded-lg transition-all"
          style={{ color: '#9080a8' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.15)'; e.currentTarget.style.color = '#f0e8fc'; }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#9080a8'; }}>
          <Edit2 size={14} />
        </button>
        <button onClick={() => onDelete(iv.id)}
          className="p-1.5 rounded-lg transition-all"
          style={{ color: '#9080a8' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,80,101,0.12)'; e.currentTarget.style.color = '#e05065'; }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#9080a8'; }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CohortDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIntervention, setEditingIntervention] = useState(null);

  const { data: cohort, isLoading } = useQuery({
    queryKey: ['cohort', id],
    queryFn: () => api.get(`/cohorts/${id}`).then(r => r.data.data),
  });

  const { data: journey, isLoading: loadingJourney } = useQuery({
    queryKey: ['journey', id],
    queryFn: () => api.get(`/cohorts/${id}/journey`).then(r => r.data.data),
    enabled: tab === 'Journey',
  });

  const invalidateJourney = () => qc.invalidateQueries({ queryKey: ['journey', id] });

  const addMutation = useMutation({
    mutationFn: (form) => api.post(`/cohorts/${id}/journey/interventions`, form).then(r => r.data),
    onSuccess: () => { invalidateJourney(); setShowAddForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ ivId, form }) => api.patch(`/cohorts/${id}/journey/interventions/${ivId}`, form).then(r => r.data),
    onSuccess: () => { invalidateJourney(); setEditingIntervention(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (ivId) => api.delete(`/cohorts/${id}/journey/interventions/${ivId}`),
    onSuccess: invalidateJourney,
  });

  const launchMutation = useMutation({
    mutationFn: () => api.post(`/cohorts/${id}/launch`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohort', id] }),
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/cohorts/${id}/complete`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohort', id] }),
  });

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-64 rounded-lg animate-pulse bg-white/5" />
      <div className="h-48 rounded-2xl animate-pulse bg-white/5" />
    </div>
  );

  const interventions = journey?.interventions || [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 page-enter">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm transition-colors"
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
            <p className="mt-1" style={{ color: '#7060a0' }}>{cohort?.organizations?.display_name}</p>
          </div>
          <div className="flex gap-3">
            {cohort?.status === 'draft' && (
              <button onClick={() => launchMutation.mutate()}
                disabled={launchMutation.isPending}
                className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                <Rocket size={16} /> {launchMutation.isPending ? 'Launching…' : 'Launch Cohort'}
              </button>
            )}
            {cohort?.status === 'active' && (
              <button onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50">
                <CheckCircle size={16} /> Mark Complete
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Status',       value: cohort?.status,          icon: Activity },
            { label: 'Participants', value: cohort?.enrollment_count ?? 0, icon: Users },
            { label: 'Start Date',   value: cohort?.start_date ? format(new Date(cohort.start_date), 'MMM d, yyyy') : '—', icon: Calendar },
            { label: 'End Date',     value: cohort?.end_date   ? format(new Date(cohort.end_date),   'MMM d, yyyy') : '—', icon: Calendar },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: 'rgba(170,120,166,0.05)', border: '1px solid rgba(170,120,166,0.14)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} style={{ color: '#7060a0' }} />
                <p className="text-xs uppercase tracking-wider" style={{ color: '#7060a0' }}>{label}</p>
              </div>
              <p className="font-semibold capitalize" style={{ color: '#f0e8fc' }}>{value}</p>
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
            {t === 'Journey' && interventions.length > 0 && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(170,120,166,0.2)', color: '#aa78a6' }}>
                {interventions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'Overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 space-y-4">
          <h2 className="font-semibold" style={{ color: '#f0e8fc' }}>Program Configuration</h2>
          <div className="grid gap-3">
            {[
              { label: 'Program Type',          value: cohort?.program_type?.replace(/_/g, ' ') },
              { label: 'Health Label',           value: cohort?.health_label || 'grey' },
              { label: 'Pre-assessment Opens',   value: cohort?.pre_assessment_open ? format(new Date(cohort.pre_assessment_open), 'MMM d, yyyy HH:mm') : 'Not set' },
              { label: 'Content Access',         value: cohort?.content_access_start ? `${format(new Date(cohort.content_access_start), 'MMM d')} – ${format(new Date(cohort.content_access_end), 'MMM d, yyyy')}` : 'Not set' },
              { label: 'Post-program Access',    value: `${cohort?.post_program_access_days || 30} days` },
              { label: 'Enrollment Capacity',    value: cohort?.enrollment_capacity ?? 'Unlimited' },
              { label: 'Internal Notes',         value: cohort?.internal_notes || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2.5 px-3 rounded-lg gap-4"
                style={{ background: 'rgba(170,120,166,0.04)', border: '1px solid rgba(170,120,166,0.08)' }}>
                <span className="text-sm" style={{ color: '#7060a0' }}>{label}</span>
                <span className="text-sm font-medium capitalize text-right" style={{ color: '#e0d8f0' }}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Journey Tab */}
      {tab === 'Journey' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Journey header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#f0e8fc' }}>Learning Journey</h2>
              <p className="text-xs mt-0.5" style={{ color: '#7060a0' }}>
                Design the sequence of interventions participants will experience.
              </p>
            </div>
            {!showAddForm && !editingIntervention && (
              <button onClick={() => setShowAddForm(true)}
                className="btn-primary flex items-center gap-2 text-sm">
                <Plus size={16} /> Add Intervention
              </button>
            )}
          </div>

          {/* Add form */}
          <AnimatePresence>
            {showAddForm && (
              <InterventionForm
                onSave={(form) => addMutation.mutate(form)}
                onCancel={() => setShowAddForm(false)}
                isSaving={addMutation.isPending}
              />
            )}
          </AnimatePresence>

          {/* Interventions list */}
          {loadingJourney ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : interventions.length === 0 && !showAddForm ? (
            <div className="glass-card p-14 text-center">
              <Layers size={44} className="mx-auto mb-4" style={{ color: '#3e2860' }} />
              <h3 className="font-semibold mb-1" style={{ color: '#9080a8' }}>No interventions yet</h3>
              <p className="text-sm mb-5" style={{ color: '#5a4870' }}>
                Start building the learning journey by adding the first intervention.
              </p>
              <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2 mx-auto text-sm">
                <Plus size={15} /> Add First Intervention
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {interventions.map((iv, i) => (
                <div key={iv.id}>
                  {editingIntervention?.id === iv.id ? (
                    <InterventionForm
                      initial={editingIntervention}
                      onSave={(form) => updateMutation.mutate({ ivId: iv.id, form })}
                      onCancel={() => setEditingIntervention(null)}
                      isSaving={updateMutation.isPending}
                    />
                  ) : (
                    <InterventionRow
                      iv={iv} index={i}
                      onEdit={(iv) => setEditingIntervention(iv)}
                      onDelete={(ivId) => {
                        if (confirm('Delete this intervention?')) deleteMutation.mutate(ivId);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {interventions.length > 0 && !showAddForm && !editingIntervention && (
            <button onClick={() => setShowAddForm(true)}
              className="w-full py-3 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all duration-200"
              style={{ color: '#7060a0', border: '1px dashed rgba(170,120,166,0.25)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#aa78a6'; e.currentTarget.style.borderColor = 'rgba(170,120,166,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#7060a0'; e.currentTarget.style.borderColor = 'rgba(170,120,166,0.25)'; }}>
              <Plus size={15} /> Add another intervention
            </button>
          )}
        </motion.div>
      )}

      {/* Analytics Tab */}
      {tab === 'Analytics' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={18} style={{ color: '#aa78a6' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#f0e8fc' }}>Analytics</h2>
          </div>
          <div className="text-center py-12" style={{ color: '#5a4870' }}>
            <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
            <p>Analytics available after cohort is launched.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
