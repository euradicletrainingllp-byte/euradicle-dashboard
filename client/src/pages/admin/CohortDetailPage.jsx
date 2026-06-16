import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, Calendar, Activity, BarChart2, Rocket, CheckCircle,
  Plus, Trash2, Edit2, Save, X, Video, BookOpen, FileText,
  Layers, MapPin, Clock, Link as LinkIcon, ChevronDown, ChevronUp,
  Package, Search, Building2, AlertCircle, Check, Brain, Target,
  ExternalLink, Globe, Headphones, Star, Sliders, WifiOff, UserPlus,
  Download, Eye, ChevronRight, Award,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import api from '../../lib/api';

// ── Shared modal portal ───────────────────────────────────────────────────────
function ModalBackdrop({ onClose, children }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 9999, background: 'rgba(8,8,18,0.82)', backdropFilter: 'blur(6px)' }}>
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        {children}
      </div>
    </motion.div>,
    document.body
  );
}

// ── Edit Cohort Modal ─────────────────────────────────────────────────────────
const PROGRAM_TYPES = [
  { value: 'leadership_dev',        label: 'Leadership Development' },
  { value: 'ac_dc',                 label: 'Assessment & Development Center' },
  { value: 'behavioral',            label: 'Behavioral Capability' },
  { value: 'consulting_capability', label: 'Consulting Capability' },
  { value: 'custom',                label: 'Custom Program' },
];

function InputEl({ ...props }) {
  return (
    <input {...props}
      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: '#f0e8fc', colorScheme: 'dark' }}
      onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
      onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.18)'} />
  );
}
function SelectEl({ children, ...props }) {
  return (
    <select {...props}
      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: '#f0e8fc' }}>
      {children}
    </select>
  );
}
function FLabel({ children, required }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7a6898' }}>
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

const STATUS_TRANSITIONS = {
  draft:     ['draft', 'active'],
  active:    ['active', 'completed', 'draft'],
  completed: ['completed', 'active'],
  archived:  ['archived'],
};

function EditCohortModal({ cohort, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name:                     cohort.name                     || '',
    org_id:                   cohort.org_id                   || '',
    program_type:             cohort.program_type             || 'leadership_dev',
    status:                   cohort.status                   || 'draft',
    start_date:               cohort.start_date?.slice(0,10)  || '',
    end_date:                 cohort.end_date?.slice(0,10)    || '',
    enrollment_capacity:      cohort.enrollment_capacity?.toString() || '',
    internal_notes:           cohort.internal_notes           || '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: orgsData } = useQuery({
    queryKey: ['organizations-dropdown'],
    queryFn: () => api.get('/organizations', { params: { limit: 100, status: 'active' } }).then(r => r.data),
    staleTime: 60_000,
  });
  const orgs = orgsData?.data || [];

  const mutation = useMutation({
    mutationFn: (data) => api.patch(`/cohorts/${cohort.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cohort', cohort.id] });
      qc.invalidateQueries({ queryKey: ['cohorts'] });
      qc.invalidateQueries({ queryKey: ['cohort-health-board'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.error?.message || 'Failed to save'),
  });

  function submit() {
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.org_id)       { setError('Organization is required'); return; }
    mutation.mutate({
      name: form.name.trim(),
      org_id: form.org_id,
      program_type: form.program_type,
      status: form.status,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      enrollment_capacity: form.enrollment_capacity ? parseInt(form.enrollment_capacity) : undefined,
      internal_notes: form.internal_notes || undefined,
    });
  }

  const hasOrg = !!form.org_id;

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div
        initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-xl"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(170,120,166,0.2)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid rgba(170,120,166,0.1)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(100,150,220,0.14)', border: '1px solid rgba(100,150,220,0.25)' }}>
            <Edit2 size={15} style={{ color: '#6496dc' }} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-white leading-tight">Edit Cohort</h2>
            <p className="text-xs mt-0.5" style={{ color: '#6a5880' }}>Editing {cohort.cohort_code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#5a4870' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
            onMouseLeave={e => e.currentTarget.style.color = '#5a4870'}><X size={17} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Organization */}
          <div className="rounded-xl p-4 space-y-2.5"
            style={{ background: hasOrg ? 'rgba(64,201,128,0.04)' : 'rgba(224,80,101,0.04)', border: `1px solid ${hasOrg ? 'rgba(64,201,128,0.2)' : 'rgba(224,80,101,0.22)'}` }}>
            <div className="flex items-center gap-2">
              <Building2 size={13} style={{ color: hasOrg ? '#40c980' : '#e05065' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: hasOrg ? '#40c980' : '#e05065' }}>
                Organization — {hasOrg ? 'Assigned' : 'Required'}
              </span>
            </div>
            <SelectEl value={form.org_id} onChange={e => set('org_id', e.target.value)}>
              <option value="">— Select Organization —</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.display_name}</option>)}
            </SelectEl>
          </div>

          <div><FLabel required>Cohort Name</FLabel><InputEl value={form.name} onChange={e => set('name', e.target.value)} placeholder="Cohort name" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><FLabel>Program Type</FLabel>
              <SelectEl value={form.program_type} onChange={e => set('program_type', e.target.value)}>
                {PROGRAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </SelectEl>
            </div>
            <div><FLabel>Status</FLabel>
              <SelectEl value={form.status} onChange={e => set('status', e.target.value)}>
                {(STATUS_TRANSITIONS[cohort?.status || 'draft'] || ['draft']).map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </SelectEl>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><FLabel>Start Date</FLabel><InputEl type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
            <div><FLabel>End Date</FLabel><InputEl type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
          </div>

          <div><FLabel>Enrollment Capacity</FLabel><InputEl type="number" min="1" value={form.enrollment_capacity} onChange={e => set('enrollment_capacity', e.target.value)} placeholder="Unlimited" /></div>

          <div><FLabel>Internal Notes</FLabel>
            <textarea value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} rows={2}
              placeholder="Visible only to admins…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: '#f0e8fc' }}
              onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.18)'} />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(224,80,101,0.08)', border: '1px solid rgba(224,80,101,0.22)', color: '#e05065' }}>
              <AlertCircle size={14} className="flex-shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending || !form.name.trim() || !form.org_id}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {mutation.isPending ? <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" /> : <Check size={15} />}
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

// ── Assessment Picker ─────────────────────────────────────────────────────────
function AssessmentPicker({ value, onChange }) {
  const [search, setSearch] = useState('');

  const { data: asmtData, isLoading } = useQuery({
    queryKey: ['assessment-picker', search],
    queryFn: () => api.get('/assessments', { params: { search, limit: 50 } }).then(r => r.data),
    staleTime: 30_000,
  });

  const items = asmtData?.data || [];
  const selectedItem = value ? items.find(i => i.id === value) : null;

  const ASMT_TYPE_COLORS = {
    pre_program: '#7c3aed', post_program: '#059669', mid_program: '#d97706',
    '360_feedback': '#2563eb', competency: '#db2777', psychometric: '#0891b2',
    knowledge_check: '#65a30d', custom: '#6b7280',
  };

  return (
    <div className="space-y-2">
      {/* Selected indicator */}
      {value && selectedItem && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(200,150,80,0.1)', border: '1px solid rgba(200,150,80,0.25)' }}>
          <Brain size={13} style={{ color: '#c89650' }} />
          <span className="text-xs font-medium flex-1 truncate" style={{ color: '#f0c070' }}>
            {selectedItem.title}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full capitalize"
            style={{ background: `${ASMT_TYPE_COLORS[selectedItem.assessment_type] || '#6b7280'}22`, color: ASMT_TYPE_COLORS[selectedItem.assessment_type] || '#6b7280' }}>
            {selectedItem.assessment_type?.replace(/_/g, ' ')}
          </span>
          <button onClick={() => onChange('')}
            className="transition-colors"
            style={{ color: '#5a7090' }}
            onMouseEnter={e => e.currentTarget.style.color = '#e05065'}
            onMouseLeave={e => e.currentTarget.style.color = '#5a7090'}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search assessment library…"
          className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: '#f0e8fc' }} />
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(170,120,166,0.14)', maxHeight: '200px', overflowY: 'auto' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-xs" style={{ color: '#5a4870' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs" style={{ color: '#5a4870' }}>
            {search ? 'No matches' : 'No assessments in library yet'}
          </div>
        ) : (
          items.map(item => (
            <button key={item.id} onClick={() => onChange(item.id === value ? '' : item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all"
              style={{
                background: item.id === value ? 'rgba(200,150,80,0.1)' : 'transparent',
                borderBottom: '1px solid rgba(170,120,166,0.08)',
              }}
              onMouseEnter={e => { if (item.id !== value) e.currentTarget.style.background = 'rgba(170,120,166,0.06)'; }}
              onMouseLeave={e => { if (item.id !== value) e.currentTarget.style.background = 'transparent'; }}>
              <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs"
                style={{ background: 'rgba(200,150,80,0.15)', color: '#c89650' }}>
                <Brain size={11} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium truncate" style={{ color: item.id === value ? '#f0c070' : '#d0c8e0' }}>
                    {item.title}
                  </p>
                  <span className="text-xs px-1 py-0 rounded flex-shrink-0"
                    style={{ background: item.library_status === 'published' ? 'rgba(100,200,120,0.12)' : 'rgba(200,160,60,0.12)', color: item.library_status === 'published' ? '#64c878' : '#c8a040', fontSize: '10px' }}>
                    {item.library_status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="text-xs truncate capitalize" style={{ color: '#5a4870' }}>
                  {item.assessment_type?.replace(/_/g, ' ')}
                  {item.sections?.length ? ` · ${item.sections.length} section(s)` : ''}
                  {item.timer_minutes ? ` · ${item.timer_minutes}m` : ''}
                </p>
              </div>
              {item.id === value && <CheckCircle size={13} style={{ color: '#c89650', flexShrink: 0 }} />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Constants ────────────────────────────────────────────────────────────────
const INTERVENTION_TYPES = [
  { value: 'pre_work',          label: 'Pre-Work',        icon: BookOpen,    color: '#d0a030', supportsContent: true  },
  { value: 'virtual_session',   label: 'Virtual Session', icon: Video,       color: '#64c878', supportsContent: false },
  { value: 'offline_session',   label: 'Offline Session', icon: WifiOff,     color: '#c86496', supportsContent: false },
  { value: 'case_study',        label: 'Case Study',      icon: FileText,    color: '#c86464', supportsContent: true  },
  { value: 'study_material',    label: 'Study Material',  icon: BookOpen,    color: '#6496dc', supportsContent: true  },
  { value: 'group_activity',    label: 'Group Activity',  icon: Users,       color: '#64c8b4', supportsContent: false },
  { value: 'assessment_window', label: 'Assessment',      icon: CheckCircle, color: '#c89650', supportsContent: false },
  { value: 'custom',            label: 'Custom',          icon: MapPin,      color: '#9080a8', supportsContent: true  },
];

const CONTENT_TYPE_LABELS = {
  video:       'Video',
  pdf:         'PDF',
  article:     'Article',
  quiz:        'Quiz',
  interactive: 'Interactive',
  audio:       'Audio',
  presentation:'Presentation',
  document:    'Document',
};

const TYPE_MAP = Object.fromEntries(INTERVENTION_TYPES.map(t => [t.value, t]));
const TABS = ['Overview', 'Participants', 'Journey', 'Assignments', 'Results'];

const ASSESSMENT_TYPE_MAP = {
  pre_program:      { label: 'Pre-Program',      color: '#7c3aed' },
  post_program:     { label: 'Post-Program',     color: '#059669' },
  mid_program:      { label: 'Mid-Program',      color: '#d97706' },
  '360_feedback':   { label: '360 Feedback',     color: '#2563eb' },
  competency:       { label: 'Competency',       color: '#db2777' },
  psychometric:     { label: 'Psychometric',     color: '#0891b2' },
  knowledge_check:  { label: 'Knowledge Check',  color: '#65a30d' },
  custom:           { label: 'Custom',           color: '#6b7280' },
};
const CONTENT_TYPE_MAP = {
  video:       { label: 'Video',       icon: Video       },
  document:    { label: 'Document',    icon: FileText    },
  article:     { label: 'Article',     icon: BookOpen    },
  audio:       { label: 'Audio',       icon: Headphones  },
  interactive: { label: 'Interactive', icon: Sliders     },
  assessment:  { label: 'Assessment',  icon: Brain       },
  other:       { label: 'Other',       icon: Package     },
};

// ── Intervention Form ────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '', intervention_type: 'virtual_session', description: '', facilitator_notes: '',
  scheduled_date: '', scheduled_time: '', scheduled_end_time: '', duration_minutes: '',
  virtual_session_link: '', virtual_session_platform: '',
  location: '', offline_facilitator: '',
  participant_groups: [],
  content_item_id: '', assessment_id: '', is_mandatory: true, status: 'published',
};

// Helper: compute duration in minutes from two HH:MM strings
function calcDuration(start, end) {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? String(diff) : '';
}

// GROUP COLORS for participant groups
const GROUP_COLORS = ['#64c8b4', '#6496dc', '#c89650', '#aa78a6', '#c86464', '#64c878', '#c86496', '#9080a8'];

// Content item picker sub-component
function ContentPicker({ value, onChange }) {
  const [search, setSearch] = useState('');

  const { data: contentData, isLoading } = useQuery({
    queryKey: ['content-picker', search],
    queryFn: () => api.get('/content', { params: { search, limit: 30 } }).then(r => r.data),
    staleTime: 30_000,
  });

  const items = contentData?.data || [];
  const selectedItem = value ? items.find(i => i.id === value) : null;

  return (
    <div className="space-y-2">
      {/* Selected indicator */}
      {value && selectedItem && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(100,150,220,0.1)', border: '1px solid rgba(100,150,220,0.25)' }}>
          <Package size={13} style={{ color: '#6496dc' }} />
          <span className="text-xs font-medium flex-1 truncate" style={{ color: '#a0c0f0' }}>
            {selectedItem.title}
          </span>
          <button onClick={() => onChange('')}
            className="text-xs ml-1 transition-colors"
            style={{ color: '#5a7090' }}
            onMouseEnter={e => e.currentTarget.style.color = '#e05065'}
            onMouseLeave={e => e.currentTarget.style.color = '#5a7090'}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search content library…"
          className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: '#f0e8fc' }} />
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(170,120,166,0.14)', maxHeight: '180px', overflowY: 'auto' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-xs" style={{ color: '#5a4870' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs" style={{ color: '#5a4870' }}>
            {search ? 'No matches' : 'No content items yet'}
          </div>
        ) : (
          items.map(item => (
            <button key={item.id} onClick={() => onChange(item.id === value ? '' : item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all"
              style={{
                background: item.id === value ? 'rgba(100,150,220,0.1)' : 'transparent',
                borderBottom: '1px solid rgba(170,120,166,0.08)',
              }}
              onMouseEnter={e => { if (item.id !== value) e.currentTarget.style.background = 'rgba(170,120,166,0.06)'; }}
              onMouseLeave={e => { if (item.id !== value) e.currentTarget.style.background = 'transparent'; }}>
              <span className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs"
                style={{ background: 'rgba(100,150,220,0.15)', color: '#6496dc' }}>
                <Package size={11} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: item.id === value ? '#a0c0f0' : '#d0c8e0' }}>
                  {item.title}
                </p>
                <p className="text-xs truncate" style={{ color: '#5a4870' }}>
                  {CONTENT_TYPE_LABELS[item.content_type] || item.content_type}
                  {item.estimated_minutes ? ` · ${item.estimated_minutes}m` : ''}
                </p>
              </div>
              {item.id === value && <CheckCircle size={13} style={{ color: '#6496dc', flexShrink: 0 }} />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function InterventionForm({ initial = EMPTY_FORM, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...initial,
    participant_groups: initial.participant_groups || [],
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedType = TYPE_MAP[form.intervention_type] || INTERVENTION_TYPES[0];
  const canHaveContent = selectedType.supportsContent;

  // Auto-compute duration when end time changes
  useEffect(() => {
    const dur = calcDuration(form.scheduled_time, form.scheduled_end_time);
    if (dur) set('duration_minutes', dur);
  }, [form.scheduled_time, form.scheduled_end_time]);

  // Group helpers
  const addGroup = useCallback(() => {
    const idx = form.participant_groups.length;
    setForm(f => ({
      ...f,
      participant_groups: [...f.participant_groups, {
        id: Date.now(),
        name: `Group ${idx + 1}`,
        description: '',
        color: GROUP_COLORS[idx % GROUP_COLORS.length],
      }],
    }));
  }, [form.participant_groups.length]);

  const updateGroup = (id, key, val) => setForm(f => ({
    ...f,
    participant_groups: f.participant_groups.map(g => g.id === id ? { ...g, [key]: val } : g),
  }));

  const removeGroup = (id) => setForm(f => ({
    ...f,
    participant_groups: f.participant_groups.filter(g => g.id !== id),
  }));

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

      {/* Date + Start Time + End Time + Duration (auto) */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Date</label>
          <input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc', colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Start Time</label>
          <input type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc', colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>End Time</label>
          <input type="time" value={form.scheduled_end_time} onChange={e => set('scheduled_end_time', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc', colorScheme: 'dark' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium flex items-center gap-1" style={{ color: '#9080a8' }}>
            Duration (min)
            {form.scheduled_time && form.scheduled_end_time && (
              <span className="text-xs normal-case font-normal" style={{ color: '#64c878' }}>auto</span>
            )}
          </label>
          <input type="number" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)}
            placeholder="60"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: form.scheduled_time && form.scheduled_end_time ? 'rgba(100,200,120,0.06)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${form.scheduled_time && form.scheduled_end_time ? 'rgba(100,200,120,0.25)' : 'rgba(170,120,166,0.2)'}`,
              color: '#f0e8fc',
            }} />
        </div>
      </div>

      {/* Virtual session fields */}
      {form.intervention_type === 'virtual_session' && (
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

      {/* Offline session fields */}
      {form.intervention_type === 'offline_session' && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(200,100,150,0.05)', border: '1px solid rgba(200,100,150,0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <WifiOff size={13} style={{ color: '#c86496' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#c86496' }}>Offline Session Details</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Venue / Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                placeholder="e.g., ITC Grand Chola, Chennai"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(200,100,150,0.2)', color: '#f0e8fc' }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Facilitator</label>
              <input value={form.offline_facilitator} onChange={e => set('offline_facilitator', e.target.value)}
                placeholder="Facilitator name"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(200,100,150,0.2)', color: '#f0e8fc' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9080a8' }}>Address / How to reach</label>
            <textarea value={form.virtual_session_link} onChange={e => set('virtual_session_link', e.target.value)}
              rows={2} placeholder="Full address, landmark, parking instructions…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(200,100,150,0.2)', color: '#f0e8fc' }} />
          </div>
        </div>
      )}

      {/* Group Activity — participant group builder */}
      {form.intervention_type === 'group_activity' && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(100,200,180,0.05)', border: '1px solid rgba(100,200,180,0.2)' }}>
          <div className="flex items-center gap-2">
            <Users size={13} style={{ color: '#64c8b4' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64c8b4' }}>Participant Groups</span>
            <span className="ml-auto text-xs" style={{ color: '#5a4870' }}>
              {form.participant_groups.length} group{form.participant_groups.length !== 1 ? 's' : ''}
            </span>
          </div>

          {form.participant_groups.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: '#5a4870' }}>
              No groups yet — add groups below and give each one a name and activity details.
            </p>
          ) : (
            <div className="space-y-3">
              {form.participant_groups.map((group, idx) => (
                <div key={group.id} className="rounded-xl p-3 space-y-2"
                  style={{ background: `${group.color}0d`, border: `1px solid ${group.color}35` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: group.color, color: '#fff' }}>
                      {idx + 1}
                    </div>
                    <input
                      value={group.name}
                      onChange={e => updateGroup(group.id, 'name', e.target.value)}
                      placeholder="Group name"
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none font-medium"
                      style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${group.color}40`, color: '#f0e8fc' }} />
                    <button onClick={() => removeGroup(group.id)}
                      className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
                      style={{ color: '#7060a0' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#e05065'; e.currentTarget.style.background = 'rgba(224,80,101,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#7060a0'; e.currentTarget.style.background = ''; }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <textarea
                    value={group.description}
                    onChange={e => updateGroup(group.id, 'description', e.target.value)}
                    rows={2}
                    placeholder="Activity details, instructions, or goals for this group…"
                    className="w-full px-2.5 py-2 rounded-lg text-xs outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${group.color}25`, color: '#d0c8e0' }} />
                </div>
              ))}
            </div>
          )}

          <button onClick={addGroup}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs transition-all"
            style={{ color: '#64c8b4', border: '1px dashed rgba(100,200,180,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(100,200,180,0.6)'; e.currentTarget.style.background = 'rgba(100,200,180,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(100,200,180,0.35)'; e.currentTarget.style.background = ''; }}>
            <UserPlus size={13} /> Add Group
          </button>
        </div>
      )}

      {/* Content item picker — for content-supporting types */}
      {canHaveContent && (
        <div>
          <button onClick={() => setShowContent(s => !s)}
            className="flex items-center gap-2 text-xs w-full px-3 py-2 rounded-xl transition-all mb-2"
            style={{
              background: form.content_item_id ? 'rgba(100,150,220,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${form.content_item_id ? 'rgba(100,150,220,0.25)' : 'rgba(170,120,166,0.14)'}`,
              color: form.content_item_id ? '#6496dc' : '#7060a0',
            }}>
            <Package size={13} />
            {form.content_item_id ? 'Content item attached — change?' : 'Attach content from library (optional)'}
            <span className="ml-auto">{showContent ? '▲' : '▼'}</span>
          </button>
          <AnimatePresence>
            {showContent && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <ContentPicker value={form.content_item_id} onChange={v => set('content_item_id', v)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Assessment picker — only for assessment_window type */}
      {form.intervention_type === 'assessment_window' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Brain size={13} style={{ color: '#c89650' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#c89650' }}>
              Link Assessment from Library
            </span>
            {!form.assessment_id && (
              <span className="text-xs ml-auto" style={{ color: '#7060a0' }}>Optional</span>
            )}
          </div>
          <AssessmentPicker value={form.assessment_id} onChange={v => set('assessment_id', v)} />
          {form.assessment_id && (
            <p className="text-xs mt-2" style={{ color: '#7060a0' }}>
              This assessment will be automatically assigned to all participants in this cohort.
            </p>
          )}
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
          <div className="flex gap-4 items-center">
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
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm transition-all"
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
function InterventionRow({ iv, index, onEdit, onDelete }) {
  const typeInfo = TYPE_MAP[iv.intervention_type] || INTERVENTION_TYPES[INTERVENTION_TYPES.length - 1];
  const Icon = typeInfo.icon;
  const hasContent = iv.content_items;
  const hasAssessment = iv.assessments;

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
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: `${typeInfo.color}18`, color: typeInfo.color }}>
            {typeInfo.label}
          </span>
          {iv.status === 'draft' && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(170,120,166,0.1)', color: '#7060a0' }}>Draft</span>
          )}
          {hasContent && (
            <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'rgba(100,150,220,0.1)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.2)' }}>
              <Package size={9} /> {iv.content_items.title}
            </span>
          )}
          {hasAssessment && (
            <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'rgba(200,150,80,0.12)', color: '#c89650', border: '1px solid rgba(200,150,80,0.25)' }}>
              <Brain size={9} /> {iv.assessments.title}
            </span>
          )}
          {iv.intervention_type === 'assessment_window' && !hasAssessment && (
            <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'rgba(170,120,166,0.08)', color: '#7060a0', border: '1px solid rgba(170,120,166,0.15)' }}>
              <Brain size={9} /> No assessment linked
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 mt-1.5 text-xs" style={{ color: '#7060a0' }}>
          {iv.scheduled_date && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {format(parseISO(iv.scheduled_date), 'MMM d, yyyy')}
              {iv.scheduled_time ? ` · ${iv.scheduled_time.slice(0, 5)}` : ''}
              {iv.scheduled_end_time ? ` – ${iv.scheduled_end_time.slice(0, 5)}` : ''}
            </span>
          )}
          {iv.duration_minutes && (
            <span className="flex items-center gap-1"><Clock size={11} />{iv.duration_minutes}m</span>
          )}
          {iv.intervention_type === 'virtual_session' && iv.virtual_session_link && (
            <span className="flex items-center gap-1 truncate max-w-48" title={iv.virtual_session_link}>
              <LinkIcon size={11} />{iv.virtual_session_platform || 'Session link'}
            </span>
          )}
          {iv.intervention_type === 'offline_session' && iv.location && (
            <span className="flex items-center gap-1 truncate max-w-64">
              <MapPin size={11} />{iv.location}
            </span>
          )}
          {iv.intervention_type === 'offline_session' && iv.offline_facilitator && (
            <span className="flex items-center gap-1">
              <Users size={11} />{iv.offline_facilitator}
            </span>
          )}
          {iv.intervention_type === 'group_activity' && iv.participant_groups?.length > 0 && (
            <span className="flex items-center gap-1">
              <Users size={11} />{iv.participant_groups.length} group{iv.participant_groups.length !== 1 ? 's' : ''}
            </span>
          )}
          {iv.is_mandatory && <span style={{ color: '#c89650' }}>Required</span>}
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

// ── Enroll Participants Modal ─────────────────────────────────────────────────
// ── Assign Library Modal (reusable for assessments + content) ────────────────
function AssignLibraryModal({ title, fetchFn, queryKey, alreadyAssigned, getLabel, getSubLabel, onAssign, onClose, loading, error, accentColor, accentBg }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: fetchFn,
    staleTime: 30_000,
  });

  const filtered = items.filter(item => {
    if (alreadyAssigned.has(item.id)) return false;
    const q = search.toLowerCase();
    return !q || getLabel(item).toLowerCase().includes(q);
  });

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: '#140e24', border: '1px solid rgba(170,120,166,0.25)', boxShadow: '0 32px 80px rgba(0,0,0,0.65)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: '#f0e8fc' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#7060a0' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
            onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
            <X size={16} />
          </button>
        </div>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7060a0' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }}
            onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.2)'} />
        </div>

        <div className="overflow-y-auto space-y-1 mb-4" style={{ maxHeight: '320px' }}>
          {isLoading ? (
            <p className="text-center py-8 text-sm" style={{ color: '#5a4870' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: '#5a4870' }}>
              {items.length === 0 ? 'No published items found' : 'All items already assigned'}
            </p>
          ) : filtered.map(item => {
            const isSel = selected === item.id;
            return (
              <div key={item.id} onClick={() => setSelected(isSel ? null : item.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                style={{ background: isSel ? accentBg : 'transparent', border: `1px solid ${isSel ? accentColor + '50' : 'transparent'}` }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: isSel ? accentBg : 'rgba(170,120,166,0.15)', color: isSel ? accentColor : '#aa78a6' }}>
                  {isSel ? <Check size={13} /> : getLabel(item)[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#f0e8fc' }}>{getLabel(item)}</p>
                  <p className="text-xs truncate capitalize" style={{ color: '#7060a0' }}>{getSubLabel(item)}</p>
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
          <p className="text-sm" style={{ color: '#7060a0' }}>
            {selected ? '1 selected' : 'Click to select'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm" style={{ color: '#9080a8' }}>Cancel</button>
            <button
              disabled={!selected || loading}
              onClick={() => selected && onAssign(selected)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: selected ? accentBg : 'rgba(255,255,255,0.05)', color: accentColor, border: `1px solid ${accentColor}50` }}>
              {loading ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

// ── Excel Export helper (two-sheet workbook) ─────────────────────────────────
function exportResponsesXLSX(assessmentTitle, responses, assignment) {
  const sections = assignment?.assessments?.sections || [];
  // Flatten all questions across sections with a numbered label
  const allQuestions = [];
  sections.forEach((sec, si) => {
    (sec.questions || []).forEach((q, qi) => {
      allQuestions.push({
        key: q.id != null ? q.id : qi,
        label: `Q${allQuestions.length + 1}`,
        text: q.text || `Question ${allQuestions.length + 1}`,
        type: q.type,
        options: q.options || [],
        section: sec.title || `Section ${si + 1}`,
      });
    });
  });

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Participant Summary ──────────────────────────────────────────────
  const summaryData = [
    ['Name', 'Email', 'Department', 'Designation', 'Status', 'Score', 'Attempt #', 'Started At', 'Submitted At'],
  ];
  (responses || []).forEach(r => {
    const u = r.enrollments?.users || {};
    summaryData.push([
      u.name || u.display_name || '',
      u.email || '',
      u.department || '',
      u.designation || '',
      r.status || '',
      r.total_score ?? '',
      r.attempt_number || '',
      r.started_at ? format(new Date(r.started_at), 'dd/MM/yyyy HH:mm') : '',
      r.submitted_at ? format(new Date(r.submitted_at), 'dd/MM/yyyy HH:mm') : '',
    ]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  // Column widths for sheet 1
  ws1['!cols'] = [24, 28, 18, 20, 12, 8, 10, 18, 18].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Participant Summary');

  // ── Sheet 2: Question Responses ───────────────────────────────────────────────
  // Row 1: question labels (Q1, Q2 …)
  // Row 2: question text (for context)
  // Row 3+: one row per participant with their selected answer
  const qHeaders = ['Name', 'Email', ...allQuestions.map(q => q.label)];
  const qSubHeaders = ['', '', ...allQuestions.map(q => q.text)];
  const qRows = [qHeaders, qSubHeaders];

  (responses || []).forEach(r => {
    const u = r.enrollments?.users || {};
    const answers = r.answers || {};
    const row = [u.name || u.display_name || '', u.email || ''];
    allQuestions.forEach(q => {
      const ans = answers[q.key];
      if (ans == null || ans === '') {
        row.push('');
      } else if (q.type === 'mcq') {
        const idx = Number(ans);
        const optionText = q.options[idx];
        if (optionText != null) {
          // Avoid double-prefix if option text already starts with "A. " pattern
          const alreadyPrefixed = /^[A-Z]\.\s/.test(String(optionText));
          row.push(alreadyPrefixed ? String(optionText) : `${String.fromCharCode(65 + idx)}. ${optionText}`);
        } else {
          row.push(String(ans));
        }
      } else {
        row.push(String(ans));
      }
    });
    qRows.push(row);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(qRows);
  // Set header row heights via row metadata isn't directly supported; set col widths
  const qColWidths = [24, 28, ...allQuestions.map(() => ({ wch: 22 }))];
  ws2['!cols'] = [{ wch: 24 }, { wch: 28 }, ...allQuestions.map(() => ({ wch: 22 }))];
  XLSX.utils.book_append_sheet(wb, ws2, 'Question Responses');

  // Write and trigger download
  const safe = assessmentTitle.replace(/[^a-z0-9]/gi, '_');
  XLSX.writeFile(wb, `${safe}_responses.xlsx`);
}

// ── Response Detail Modal ─────────────────────────────────────────────────────
function ResponseDetailModal({ response, assessment, onClose }) {
  const user = response.enrollments?.users || {};
  const answers = response.answers || {};
  const sections = assessment?.assessments?.sections || [];

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div
        initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-2xl"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(170,120,166,0.2)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(170,120,166,0.1)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(200,150,80,0.14)', border: '1px solid rgba(200,150,80,0.25)' }}>
            <Eye size={15} style={{ color: '#c89650' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white leading-tight truncate">{user.name || user.display_name || 'Participant'}</h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: '#6a5880' }}>{user.email} {user.designation ? `· ${user.designation}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {response.total_score != null && (
              <span className="text-sm font-bold px-3 py-1 rounded-lg" style={{ background: 'rgba(100,200,120,0.1)', color: '#64c878', border: '1px solid rgba(100,200,120,0.25)' }}>
                Score: {response.total_score}
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#5a4870' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
              onMouseLeave={e => e.currentTarget.style.color = '#5a4870'}><X size={17} /></button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {sections.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#5a4870' }}>No sections / question structure available.</p>
          ) : sections.map((sec, si) => (
            <div key={si}>
              <h3 className="font-semibold mb-3 text-sm" style={{ color: '#c8a0c4' }}>{sec.title || `Section ${si + 1}`}</h3>
              <div className="space-y-4">
                {(sec.questions || []).map((q, qi) => {
                  const qKey = q.id || qi;
                  const answer = answers[qKey];
                  return (
                    <div key={qi} className="rounded-xl p-4 space-y-2"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.1)' }}>
                      <p className="text-sm" style={{ color: '#e0d8f0' }}>
                        <span className="text-xs font-bold mr-2" style={{ color: '#5a4870' }}>{si + 1}.{qi + 1}</span>
                        {q.text}
                      </p>
                      {answer == null || answer === '' ? (
                        <p className="text-xs italic" style={{ color: '#5a4870' }}>No answer provided</p>
                      ) : q.type === 'mcq' ? (
                        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(170,120,166,0.1)', color: '#f0c070' }}>
                          {String.fromCharCode(65 + answer)}. {(q.options || [])[answer] || answer}
                        </div>
                      ) : (
                        <div className="text-sm px-3 py-2 rounded-lg whitespace-pre-wrap" style={{ background: 'rgba(170,120,166,0.08)', color: '#d0c8e0' }}>
                          {String(answer)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(170,120,166,0.1)' }}>
          <div className="flex items-center justify-between text-xs" style={{ color: '#5a4870' }}>
            <span>Attempt #{response.attempt_number}</span>
            {response.submitted_at && <span>Submitted {format(new Date(response.submitted_at), 'dd MMM yyyy, HH:mm')}</span>}
          </div>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

// ── Per-Assessment Results Panel ──────────────────────────────────────────────
function AssessmentResultCard({ cohortId, assignment }) {
  const [expanded, setExpanded] = useState(false);
  const [viewingResponse, setViewingResponse] = useState(null);

  const { data: responses, isLoading } = useQuery({
    queryKey: ['cohort-asmt-responses', cohortId, assignment.id],
    queryFn: () => api.get(`/cohorts/${cohortId}/assessments/${assignment.id}/responses`).then(r => r.data.data),
    enabled: expanded,
    staleTime: 30_000,
  });

  const asmtInfo = ASSESSMENT_TYPE_MAP[assignment.assessments?.assessment_type] || { label: 'Assessment', color: '#aa78a6' };
  const submitted = (responses || []).filter(r => r.status === 'submitted' || r.status === 'scored').length;
  const inProgress = (responses || []).filter(r => r.status === 'in_progress').length;
  const total = (responses || []).length;

  return (
    <>
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(170,120,166,0.14)' }}>
      {/* Assessment header row */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-all"
        style={{ background: expanded ? 'rgba(170,120,166,0.06)' : 'rgba(255,255,255,0.02)' }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${asmtInfo.color}18`, border: `1px solid ${asmtInfo.color}35` }}>
          <Brain size={16} style={{ color: asmtInfo.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: '#f0e8fc' }}>
            {assignment.assessments?.title || 'Untitled'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#7060a0' }}>
            <span style={{ color: asmtInfo.color }}>{asmtInfo.label}</span>
            {assignment.assessments?.sections?.length ? ` · ${assignment.assessments.sections.length} section(s)` : ''}
            {assignment.is_mandatory && <span className="ml-2" style={{ color: '#f59e0b' }}>Mandatory</span>}
          </p>
        </div>
        {expanded && responses && (
          <div className="flex items-center gap-3 flex-shrink-0 text-xs">
            <span className="px-2 py-1 rounded-lg" style={{ background: 'rgba(64,201,128,0.1)', color: '#40c980', border: '1px solid rgba(64,201,128,0.2)' }}>
              {submitted} submitted
            </span>
            {inProgress > 0 && (
              <span className="px-2 py-1 rounded-lg" style={{ background: 'rgba(200,150,80,0.1)', color: '#c89650', border: '1px solid rgba(200,150,80,0.2)' }}>
                {inProgress} in progress
              </span>
            )}
            <button
              onClick={e => { e.stopPropagation(); exportResponsesXLSX(assignment.assessments?.title || 'assessment', responses, assignment); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: 'rgba(100,150,220,0.12)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.25)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,150,220,0.22)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,150,220,0.12)'}>
              <Download size={12} /> Export Excel
            </button>
          </div>
        )}
        <span style={{ color: '#5a4870', flexShrink: 0 }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </div>

      {/* Expanded response table */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', borderTop: '1px solid rgba(170,120,166,0.1)' }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-sm" style={{ color: '#5a4870' }}>
                <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin mr-2" />
                Loading responses…
              </div>
            ) : !responses?.length ? (
              <div className="py-10 text-center" style={{ color: '#5a4870' }}>
                <Brain size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No responses yet. Participants haven't started this assessment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(170,120,166,0.12)', background: 'rgba(170,120,166,0.05)' }}>
                      {['Participant', 'Department', 'Status', 'Score', 'Attempt', 'Submitted At', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#7060a0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map(r => {
                      const u = r.enrollments?.users || {};
                      const isSubmitted = r.status === 'submitted' || r.status === 'scored';
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid rgba(170,120,166,0.08)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                style={{ background: 'linear-gradient(135deg,#aa78a6,#6040a0)', color: '#fff' }}>
                                {(u.name || u.display_name || '?')[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate" style={{ color: '#f0e8fc' }}>{u.name || u.display_name || '—'}</p>
                                <p className="text-xs truncate" style={{ color: '#7060a0' }}>{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#9080a8' }}>{u.department || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium"
                              style={{
                                background: isSubmitted ? 'rgba(64,201,128,0.1)' : r.status === 'in_progress' ? 'rgba(200,150,80,0.1)' : 'rgba(170,120,166,0.08)',
                                color: isSubmitted ? '#40c980' : r.status === 'in_progress' ? '#c89650' : '#7060a0',
                                border: `1px solid ${isSubmitted ? 'rgba(64,201,128,0.25)' : r.status === 'in_progress' ? 'rgba(200,150,80,0.25)' : 'rgba(170,120,166,0.15)'}`,
                              }}>
                              {r.status === 'in_progress' ? 'In Progress' : r.status === 'submitted' ? 'Submitted' : r.status === 'scored' ? 'Scored' : r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold" style={{ color: r.total_score != null ? '#f0e8fc' : '#5a4870' }}>
                            {r.total_score != null ? r.total_score : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-center" style={{ color: '#9080a8' }}>#{r.attempt_number}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#9080a8' }}>
                            {r.submitted_at ? format(new Date(r.submitted_at), 'dd MMM yyyy, HH:mm') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {isSubmitted && (
                              <button onClick={() => setViewingResponse(r)}
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                                style={{ color: '#aa78a6', border: '1px solid rgba(170,120,166,0.2)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.12)'; e.currentTarget.style.color = '#f0e8fc'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#aa78a6'; }}>
                                <Eye size={11} /> View
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* Response detail modal */}
    <AnimatePresence>
      {viewingResponse && (
        <ResponseDetailModal
          response={viewingResponse}
          assessment={assignment}
          onClose={() => setViewingResponse(null)}
        />
      )}
    </AnimatePresence>
    </>
  );
}

function EnrollModal({ allParticipants, enrolled, onEnroll, onClose, loading, error }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const enrolledIds = new Set((enrolled || []).map(e => e.participant_id));

  const filtered = allParticipants.filter(p => {
    if (enrolledIds.has(p.id)) return false;
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.department?.toLowerCase().includes(q);
  });

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <ModalBackdrop onClose={onClose}>
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

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7060a0' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or department…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }}
            onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.2)'} />
        </div>

        {/* List */}
        <div className="overflow-y-auto space-y-1 mb-4" style={{ maxHeight: '320px' }}>
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: '#5a4870' }}>
              {allParticipants.length === 0 ? 'Loading participants…' : 'No participants found'}
            </p>
          ) : filtered.map(p => {
            const isSelected = selected.includes(p.id);
            return (
              <div key={p.id} onClick={() => toggle(p.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                style={{ background: isSelected ? 'rgba(100,150,220,0.12)' : 'transparent', border: `1px solid ${isSelected ? 'rgba(100,150,220,0.3)' : 'transparent'}` }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: isSelected ? 'rgba(100,150,220,0.3)' : 'rgba(170,120,166,0.2)', color: isSelected ? '#6496dc' : '#aa78a6' }}>
                  {isSelected ? <Check size={13} /> : p.name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#f0e8fc' }}>{p.name}</p>
                  <p className="text-xs truncate" style={{ color: '#7060a0' }}>
                    {p.email}{p.designation ? ` · ${p.designation}` : ''}{p.department ? ` · ${p.department}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
            style={{ background: 'rgba(224,80,101,0.12)', border: '1px solid rgba(224,80,101,0.25)', color: '#e05065' }}>
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(170,120,166,0.12)' }}>
          <p className="text-sm" style={{ color: '#7060a0' }}>
            {selected.length > 0 ? `${selected.length} selected` : 'Click to select participants'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm" style={{ color: '#9080a8' }}>Cancel</button>
            <button
              disabled={!selected.length || loading}
              onClick={() => onEnroll(selected)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: selected.length ? 'rgba(100,150,220,0.2)' : 'rgba(255,255,255,0.05)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.3)' }}>
              {loading ? 'Enrolling…' : `Enroll ${selected.length || ''}`}
            </button>
          </div>
        </div>
      </motion.div>
    </ModalBackdrop>
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
  const [showEditCohort, setShowEditCohort] = useState(false);

  const { data: cohort, isLoading } = useQuery({
    queryKey: ['cohort', id],
    queryFn: () => api.get(`/cohorts/${id}`).then(r => r.data.data),
  });

  const { data: journey, isLoading: loadingJourney } = useQuery({
    queryKey: ['journey', id],
    queryFn: () => api.get(`/cohorts/${id}/journey`).then(r => r.data.data),
    enabled: tab === 'Journey',
  });

  const { data: assignedAssessments, isLoading: loadingAsmts } = useQuery({
    queryKey: ['cohort-assessments', id],
    queryFn: () => api.get(`/cohorts/${id}/assessments`).then(r => r.data.data),
    enabled: tab === 'Assignments' || tab === 'Results',
  });

  const { data: assignedContent, isLoading: loadingContent } = useQuery({
    queryKey: ['cohort-content', id],
    queryFn: () => api.get(`/cohorts/${id}/content`).then(r => r.data.data),
    enabled: tab === 'Assignments',
  });

  const removeAssessmentMutation = useMutation({
    mutationFn: (assignId) => api.delete(`/cohorts/${id}/assessments/${assignId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohort-assessments', id] }),
  });

  const removeContentMutation = useMutation({
    mutationFn: (assignId) => api.delete(`/cohorts/${id}/content/${assignId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohort-content', id] }),
  });

  // ── Assignment modals state ───────────────────────────────────────────────
  const [showAssignAssessmentModal, setShowAssignAssessmentModal] = useState(false);
  const [showAssignContentModal, setShowAssignContentModal] = useState(false);
  const [assignError, setAssignError] = useState('');

  const assignAssessmentMutation = useMutation({
    mutationFn: (assessment_id) => api.post(`/cohorts/${id}/assessments`, { assessment_id, mandatory: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cohort-assessments', id] }); setShowAssignAssessmentModal(false); setAssignError(''); },
    onError: (err) => setAssignError(err.response?.data?.error?.message || 'Failed to assign assessment'),
  });

  const assignContentMutation = useMutation({
    mutationFn: (content_item_id) => api.post(`/cohorts/${id}/content`, { content_item_id, visibility_status: 'published', mandatory: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cohort-content', id] }); setShowAssignContentModal(false); setAssignError(''); },
    onError: (err) => setAssignError(err.response?.data?.error?.message || 'Failed to assign content'),
  });

  // ── Participants tab state ─────────────────────────────────────────────────
  const [enrollSearch, setEnrollSearch] = useState('');
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const { data: enrollments, isLoading: loadingEnrollments, isError: enrollmentsError } = useQuery({
    queryKey: ['cohort-enrollments', id],
    queryFn: () => api.get(`/cohorts/${id}/enrollments`).then(r => r.data.data),
    enabled: tab === 'Participants',
    retry: 1,
  });

  const { data: allParticipants } = useQuery({
    queryKey: ['users-participants'],
    queryFn: () => api.get('/users', { params: { role: 'PARTICIPANT', limit: 200 } }).then(r => r.data.data),
    enabled: showEnrollModal,
  });

  const [enrollError, setEnrollError] = useState('');

  const enrollMutation = useMutation({
    mutationFn: (ids) => api.post(`/cohorts/${id}/enrollments/bulk`, { participant_ids: ids }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['cohort-enrollments', id] });
      const d = res.data;
      if (d?.enrolled > 0) setShowEnrollModal(false);
      else setEnrollError(d?.errors?.[0]?.error || 'No participants were enrolled');
    },
    onError: (err) => setEnrollError(err.response?.data?.error?.message || 'Enrollment failed'),
  });

  const removeEnrollMutation = useMutation({
    mutationFn: (enrollId) => api.delete(`/cohorts/${id}/enrollments/${enrollId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cohort-enrollments', id] }),
    onError: (err) => alert(err.response?.data?.error?.message || 'Failed to remove participant'),
  });

  const invalidateJourney = () => qc.invalidateQueries({ queryKey: ['journey', id] });

  const addMutation = useMutation({
    mutationFn: (form) => api.post(`/cohorts/${id}/journey/interventions`, {
      ...form,
      content_item_id: form.content_item_id || null,
      assessment_id: form.assessment_id || null,
    }).then(r => r.data),
    onSuccess: () => { invalidateJourney(); setShowAddForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ ivId, form }) => api.patch(`/cohorts/${id}/journey/interventions/${ivId}`, {
      ...form,
      content_item_id: form.content_item_id || null,
      assessment_id: form.assessment_id || null,
    }).then(r => r.data),
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

  const interventions = [...(journey?.interventions || [])].sort((a, b) => {
    if (!a.scheduled_date && !b.scheduled_date) return 0;
    if (!a.scheduled_date) return 1;
    if (!b.scheduled_date) return -1;
    return new Date(a.scheduled_date) - new Date(b.scheduled_date);
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 page-enter">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: '#7060a0' }}
        onMouseEnter={e => e.currentTarget.style.color = '#e8e0f0'}
        onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
        <ArrowLeft size={16} /> Back to Cohorts
      </button>

      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-mono mb-1" style={{ color: '#aa78a6' }}>{cohort?.cohort_code}</p>
            <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>{cohort?.name}</h1>
            <p className="mt-1" style={{ color: '#7060a0' }}>{cohort?.organizations?.display_name}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowEditCohort(true)}
              className="btn-ghost flex items-center gap-2 text-sm">
              <Edit2 size={15} /> Edit
            </button>
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
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50"
                style={{ background: 'rgba(100,200,150,0.12)', color: '#40c980', border: '1px solid rgba(100,200,150,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,200,150,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,200,150,0.12)'}>
                <CheckCircle size={16} /> {completeMutation.isPending ? 'Completing…' : 'Mark Complete'}
              </button>
            )}
            {(launchMutation.error || completeMutation.error) && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs self-center"
                style={{ background: 'rgba(224,80,101,0.1)', border: '1px solid rgba(224,80,101,0.2)', color: '#e05065' }}>
                <AlertCircle size={13} />
                {launchMutation.error?.response?.data?.error?.message || completeMutation.error?.response?.data?.error?.message || 'Action failed'}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Status',       value: cohort?.status,                    icon: Activity  },
            { label: 'Participants', value: cohort?.enrollment_count ?? 0,      icon: Users     },
            { label: 'Start Date',   value: cohort?.start_date ? format(parseISO(cohort.start_date), 'MMM d, yyyy') : '—', icon: Calendar },
            { label: 'End Date',     value: cohort?.end_date   ? format(parseISO(cohort.end_date),   'MMM d, yyyy') : '—', icon: Calendar },
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
      <div className="flex gap-1 p-1 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.1)' }}>
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
            {t === 'Results' && assignedAssessments?.length > 0 && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(200,150,80,0.2)', color: '#c89650' }}>
                {assignedAssessments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {/* ── Participants Tab ─────────────────────────────────────────────── */}
      {tab === 'Participants' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <Users size={18} style={{ color: '#aa78a6' }} />
            <h2 className="text-lg font-semibold flex-1" style={{ color: '#f0e8fc' }}>Enrolled Participants</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(170,120,166,0.15)', color: '#aa78a6' }}>
              {enrollments?.length ?? 0}
            </span>
            <button onClick={() => { setShowEnrollModal(true); setEnrollError(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'rgba(100,150,220,0.15)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.3)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,150,220,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,150,220,0.15)'}>
              <Plus size={14} /> Enroll Participants
            </button>
          </div>

          {/* Search filter */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7060a0' }} />
            <input value={enrollSearch} onChange={e => setEnrollSearch(e.target.value)}
              placeholder="Filter by name or email…"
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: '#f0e8fc' }}
              onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.18)'} />
          </div>

          {loadingEnrollments ? (
            <div className="text-center py-10" style={{ color: '#5a4870' }}>Loading…</div>
          ) : enrollmentsError ? (
            <div className="text-center py-10 flex flex-col items-center gap-2" style={{ color: '#e05065' }}>
              <AlertCircle size={28} className="opacity-60" />
              <p className="text-sm">Failed to load participants. Restart the server and refresh.</p>
            </div>
          ) : !enrollments?.length ? (
            <div className="text-center py-12" style={{ color: '#5a4870' }}>
              <Users size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No participants enrolled yet.</p>
              <p className="text-xs mt-1">Click "Enroll Participants" to add people to this cohort.</p>
            </div>
          ) : (() => {
            const q = enrollSearch.toLowerCase();
            const filtered = enrollments.filter(e =>
              !q || e.users?.name?.toLowerCase().includes(q) || e.users?.email?.toLowerCase().includes(q)
            );
            return filtered.length === 0 ? (
              <div className="text-center py-8" style={{ color: '#5a4870' }}>No participants match "{enrollSearch}"</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.1)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#aa78a6,#6040a0)', color: '#fff' }}>
                      {e.users?.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#f0e8fc' }}>{e.users?.name || '—'}</p>
                      <p className="text-xs truncate" style={{ color: '#7060a0' }}>
                        {e.users?.email}
                        {e.users?.designation && ` · ${e.users.designation}`}
                        {e.users?.department && ` · ${e.users.department}`}
                      </p>
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: '#5a4870' }}>
                      Enrolled {e.enrolled_at ? format(new Date(e.enrolled_at), 'd MMM yyyy') : '—'}
                    </span>
                    <button onClick={() => { if (confirm(`Remove ${e.users?.name} from this cohort?`)) removeEnrollMutation.mutate(e.id); }}
                      className="p-1.5 rounded-lg transition-colors flex-shrink-0" style={{ color: '#9080a8' }}
                      onMouseEnter={ev => { ev.currentTarget.style.color = '#e05065'; ev.currentTarget.style.background = 'rgba(224,80,101,0.1)'; }}
                      onMouseLeave={ev => { ev.currentTarget.style.color = '#9080a8'; ev.currentTarget.style.background = ''; }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* ── Enroll Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEnrollModal && (
          <EnrollModal
            allParticipants={allParticipants || []}
            enrolled={enrollments || []}
            onEnroll={(ids) => enrollMutation.mutate(ids)}
            onClose={() => { setShowEnrollModal(false); setEnrollError(''); }}
            loading={enrollMutation.isPending}
            error={enrollError}
          />
        )}
      </AnimatePresence>

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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#f0e8fc' }}>Learning Journey</h2>
              <p className="text-xs mt-0.5" style={{ color: '#7060a0' }}>
                Design the sequence of interventions participants will experience.
              </p>
            </div>
            {!showAddForm && !editingIntervention && (
              <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2 text-sm">
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
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-2xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : interventions.length === 0 && !showAddForm ? (
            <div className="glass-card p-14 text-center">
              <Layers size={44} className="mx-auto mb-4" style={{ color: '#3e2860' }} />
              <h3 className="font-semibold mb-1" style={{ color: '#9080a8' }}>No interventions yet</h3>
              <p className="text-sm mb-5" style={{ color: '#5a4870' }}>
                Start building the learning journey by adding the first intervention.
              </p>
              <button onClick={() => setShowAddForm(true)}
                className="btn-primary flex items-center gap-2 mx-auto text-sm">
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
                      onEdit={(iv) => setEditingIntervention({ ...iv, assessment_id: iv.assessments?.id || iv.assessment_id || '' })}
                      onDelete={(ivId) => {
                        if (window.confirm('Delete this intervention?')) deleteMutation.mutate(ivId);
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

      {/* Assignments Tab */}
      {tab === 'Assignments' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* Assigned Assessments */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Brain size={18} style={{ color: '#aa78a6' }} />
              <h2 className="text-lg font-semibold" style={{ color: '#f0e8fc' }}>Assigned Assessments</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(170,120,166,0.15)', color: '#aa78a6' }}>
                {assignedAssessments?.length ?? 0}
              </span>
              <button onClick={() => { setAssignError(''); setShowAssignAssessmentModal(true); }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'rgba(170,120,166,0.12)', color: '#aa78a6', border: '1px solid rgba(170,120,166,0.25)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(170,120,166,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(170,120,166,0.12)'}>
                <Plus size={14} /> Assign Assessment
              </button>
            </div>
            {loadingAsmts ? (
              <div className="text-center py-8" style={{ color: '#5a4870' }}>Loading…</div>
            ) : !assignedAssessments?.length ? (
              <div className="text-center py-10" style={{ color: '#5a4870' }}>
                <Brain size={36} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm">No assessments assigned yet. Use the Assessments library to assign.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedAssessments.map(a => {
                  const typeInfo = ASSESSMENT_TYPE_MAP[a.assessments?.assessment_type] || ASSESSMENT_TYPE_MAP.custom;
                  return (
                    <div key={a.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.12)' }}>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${typeInfo.color}22`, color: typeInfo.color }}>
                        {typeInfo.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#f0e8fc' }}>
                          {a.assessments?.title || 'Untitled'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#7060a0' }}>
                          {a.assessments?.sections?.length ?? 0} section(s)
                          {a.access_open_at && ` · Opens ${format(parseISO(a.access_open_at), 'd MMM yyyy')}`}
                          {a.access_close_at && ` · Closes ${format(parseISO(a.access_close_at), 'd MMM yyyy')}`}
                          {a.is_mandatory && <span className="ml-2 text-amber-400">Mandatory</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => { if (confirm('Remove this assessment from cohort?')) removeAssessmentMutation.mutate(a.id); }}
                        className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                        style={{ color: '#9080a8' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#e05065'; e.currentTarget.style.background = 'rgba(224,80,101,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#9080a8'; e.currentTarget.style.background = ''; }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assigned Content */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Target size={18} style={{ color: '#aa78a6' }} />
              <h2 className="text-lg font-semibold" style={{ color: '#f0e8fc' }}>Assigned Content</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(170,120,166,0.15)', color: '#aa78a6' }}>
                {assignedContent?.length ?? 0}
              </span>
              <button onClick={() => { setAssignError(''); setShowAssignContentModal(true); }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'rgba(100,150,220,0.12)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.25)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,150,220,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,150,220,0.12)'}>
                <Plus size={14} /> Assign Content
              </button>
            </div>
            {loadingContent ? (
              <div className="text-center py-8" style={{ color: '#5a4870' }}>Loading…</div>
            ) : !assignedContent?.length ? (
              <div className="text-center py-10" style={{ color: '#5a4870' }}>
                <Target size={36} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm">No content assigned yet. Use the Content library to assign.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedContent.map(c => {
                  const typeInfo = CONTENT_TYPE_MAP[c.content_items?.content_type] || CONTENT_TYPE_MAP.other;
                  const TypeIcon = typeInfo.icon;
                  return (
                    <div key={c.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.12)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(170,120,166,0.12)' }}>
                        <TypeIcon size={15} style={{ color: '#aa78a6' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate" style={{ color: '#f0e8fc' }}>
                            {c.content_items?.title || 'Untitled'}
                          </p>
                          {c.sequence_order != null && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(170,120,166,0.12)', color: '#aa78a6' }}>
                              L{c.sequence_order}
                            </span>
                          )}
                          {c.is_mandatory && (
                            <span className="text-xs" style={{ color: '#f59e0b' }}>Mandatory</span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: '#7060a0' }}>
                          {typeInfo.label}
                          {c.module_name && ` · ${c.module_name}`}
                          {c.content_items?.estimated_minutes && ` · ${c.content_items.estimated_minutes} min`}
                          {c.release_at && ` · Released ${format(parseISO(c.release_at), 'd MMM yyyy')}`}
                        </p>
                      </div>
                      {(c.content_items?.external_url || c.content_items?.file_url) && (
                        <a href={c.content_items.external_url || c.content_items.file_url} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg flex-shrink-0" style={{ color: '#7060a0' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#aa78a6'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#7060a0'; }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => { if (confirm('Remove this content from cohort?')) removeContentMutation.mutate(c.id); }}
                        className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                        style={{ color: '#9080a8' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#e05065'; e.currentTarget.style.background = 'rgba(224,80,101,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#9080a8'; e.currentTarget.style.background = ''; }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </motion.div>
      )}

      {/* Results Tab */}
      {tab === 'Results' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#f0e8fc' }}>
                <Award size={18} style={{ color: '#c89650' }} />
                Assessment Results
              </h2>
              <p className="text-xs mt-0.5" style={{ color: '#7060a0' }}>
                View participant responses for each assessment assigned to this cohort. Click an assessment to expand.
              </p>
            </div>
          </div>

          {/* Summary stats */}
          {!loadingAsmts && assignedAssessments?.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Assessments',  value: assignedAssessments.length, color: '#aa78a6' },
                { label: 'Participants', value: cohort?.enrollment_count ?? 0, color: '#6496dc' },
                { label: 'Cohort Status', value: cohort?.status, color: '#64c878' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-4 text-center"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.12)' }}>
                  <p className="text-2xl font-bold capitalize" style={{ color }}>{value ?? '—'}</p>
                  <p className="text-xs mt-1" style={{ color: '#7060a0' }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {loadingAsmts ? (
            <div className="glass-card p-10 text-center">
              <div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-sm" style={{ color: '#5a4870' }}>Loading assessments…</p>
            </div>
          ) : !assignedAssessments?.length ? (
            <div className="glass-card p-16 text-center">
              <Brain size={44} className="mx-auto mb-4 opacity-20" style={{ color: '#aa78a6' }} />
              <h3 className="font-semibold mb-1" style={{ color: '#9080a8' }}>No assessments assigned</h3>
              <p className="text-sm" style={{ color: '#5a4870' }}>
                Go to the <strong style={{ color: '#aa78a6' }}>Assignments</strong> tab to assign assessments to this cohort first.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedAssessments.map(assignment => (
                <AssessmentResultCard key={assignment.id} cohortId={id} assignment={assignment} />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Edit Cohort Modal */}
      <AnimatePresence>
        {showEditCohort && cohort && (
          <EditCohortModal cohort={cohort} onClose={() => setShowEditCohort(false)} />
        )}
      </AnimatePresence>

      {/* Assign Assessment Modal */}
      <AnimatePresence>
        {showAssignAssessmentModal && (
          <AssignLibraryModal
            title="Assign Assessment"
            fetchFn={() => api.get('/assessments', { params: { library_status: 'published', limit: 100 } }).then(r => r.data.data || [])}
            queryKey={['assessments-library-published']}
            alreadyAssigned={new Set((assignedAssessments || []).map(a => a.assessment_id))}
            getLabel={a => a.title}
            getSubLabel={a => `${a.assessment_type?.replace(/_/g,' ')} · ${a.sections?.length ?? 0} sections`}
            onAssign={(itemId) => assignAssessmentMutation.mutate(itemId)}
            onClose={() => { setShowAssignAssessmentModal(false); setAssignError(''); }}
            loading={assignAssessmentMutation.isPending}
            error={assignError}
            accentColor="#aa78a6"
            accentBg="rgba(170,120,166,0.15)"
          />
        )}
      </AnimatePresence>

      {/* Assign Content Modal */}
      <AnimatePresence>
        {showAssignContentModal && (
          <AssignLibraryModal
            title="Assign Content"
            fetchFn={() => api.get('/content', { params: { library_status: 'published', limit: 100 } }).then(r => r.data.data || [])}
            queryKey={['content-library-published']}
            alreadyAssigned={new Set((assignedContent || []).map(c => c.content_item_id))}
            getLabel={c => c.title}
            getSubLabel={c => `${c.content_type?.replace(/_/g,' ')}${c.estimated_minutes ? ` · ${c.estimated_minutes} min` : ''}`}
            onAssign={(itemId) => assignContentMutation.mutate(itemId)}
            onClose={() => { setShowAssignContentModal(false); setAssignError(''); }}
            loading={assignContentMutation.isPending}
            error={assignError}
            accentColor="#6496dc"
            accentBg="rgba(100,150,220,0.15)"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
