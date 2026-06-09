import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, GraduationCap, Users, Clock, ChevronRight,
  X, Check, Building2, AlertCircle, Edit2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import api from '../../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const PROGRAM_TYPES = [
  { value: 'leadership_dev',        label: 'Leadership Development' },
  { value: 'ac_dc',                 label: 'Assessment & Development Center' },
  { value: 'behavioral',            label: 'Behavioral Capability' },
  { value: 'consulting_capability', label: 'Consulting Capability' },
  { value: 'custom',                label: 'Custom Program' },
];

const HEALTH_COLORS = {
  green: '#4ade80', amber: '#fbbf24', red: '#f87171', grey: '#64748b',
};

const STATUS_STYLES = {
  draft:     { bg: 'rgba(150,140,200,0.12)', text: '#b8aad8', border: 'rgba(150,140,200,0.22)' },
  active:    { bg: 'rgba(64,201,128,0.12)',  text: '#40c980', border: 'rgba(64,201,128,0.25)' },
  completed: { bg: 'rgba(62,50,100,0.28)',   text: '#a898cc', border: 'rgba(62,50,100,0.5)' },
  archived:  { bg: 'rgba(90,80,112,0.18)',   text: '#7a708a', border: 'rgba(90,80,112,0.3)' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: '#7a6898' }}>
      {children}{required && <span className="text-red-400 ml-0.5 normal-case">*</span>}
    </label>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: '#4a3860' }}>{hint}</p>}
    </div>
  );
}

function InputEl({ ...props }) {
  return (
    <input {...props}
      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(170,120,166,0.18)',
        color: '#f0e8fc',
        colorScheme: 'dark',
      }}
      onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
      onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.18)'}
    />
  );
}

function SelectEl({ children, ...props }) {
  return (
    <select {...props}
      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(170,120,166,0.18)',
        color: '#f0e8fc',
      }}>
      {children}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal portal wrapper
// ─────────────────────────────────────────────────────────────────────────────
function ModalBackdrop({ onClose, children }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 9999, background: 'rgba(8,8,18,0.82)', backdropFilter: 'blur(6px)' }}>
      <div
        className="flex min-h-full items-center justify-center p-4 sm:p-6"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        {children}
      </div>
    </motion.div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Org required row (visual state)
// ─────────────────────────────────────────────────────────────────────────────
function OrgSelector({ value, onChange, orgs, loading }) {
  const hasOrg = !!value;
  return (
    <div className="rounded-xl p-4 space-y-2.5"
      style={{
        background: hasOrg ? 'rgba(64,201,128,0.04)' : 'rgba(224,80,101,0.04)',
        border: `1px solid ${hasOrg ? 'rgba(64,201,128,0.2)' : 'rgba(224,80,101,0.22)'}`,
      }}>
      <div className="flex items-center gap-2">
        <Building2 size={13} style={{ color: hasOrg ? '#40c980' : '#e05065' }} />
        <span className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: hasOrg ? '#40c980' : '#e05065' }}>
          Organization — {hasOrg ? 'Assigned' : 'Required'}
        </span>
      </div>
      <SelectEl value={value} onChange={e => onChange(e.target.value)} disabled={loading}>
        <option value="">{loading ? 'Loading organizations…' : '— Select Organization —'}</option>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.display_name}</option>)}
      </SelectEl>
      {!hasOrg && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#e05065' }}>
          <AlertCircle size={11} />
          A cohort must be assigned to an organization to be created.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cohort modal (create + edit)
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_COHORT = {
  name: '', org_id: '', program_type: 'leadership_dev',
  start_date: '', end_date: '', enrollment_capacity: '', internal_notes: '',
  pre_assessment_open: '', pre_assessment_close: '',
  content_access_start: '', content_access_end: '',
  post_program_access_days: '30',
};

function CohortModal({ mode = 'create', cohort, onClose, onCreated }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(
    isEdit
      ? {
          name:                      cohort.name                     || '',
          org_id:                    cohort.org_id                   || '',
          program_type:              cohort.program_type             || 'leadership_development',
          start_date:                cohort.start_date?.slice(0, 10) || '',
          end_date:                  cohort.end_date?.slice(0, 10)   || '',
          enrollment_capacity:       cohort.enrollment_capacity?.toString() || '',
          internal_notes:            cohort.internal_notes           || '',
          pre_assessment_open:       cohort.pre_assessment_open      || '',
          pre_assessment_close:      cohort.pre_assessment_close     || '',
          content_access_start:      cohort.content_access_start     || '',
          content_access_end:        cohort.content_access_end       || '',
          post_program_access_days:  cohort.post_program_access_days?.toString() || '30',
        }
      : { ...EMPTY_COHORT }
  );
  const [error, setError]       = useState('');
  const [showAdvanced, setAdv]  = useState(false);
  const qc = useQueryClient();

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['organizations-dropdown'],
    queryFn: () => api.get('/organizations', { params: { limit: 100, status: 'active' } }).then(r => r.data),
    staleTime: 60_000,
  });
  const orgs = orgsData?.data || [];

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.patch(`/cohorts/${cohort.id}`, data)
        : api.post('/cohorts', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['cohorts'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      qc.invalidateQueries({ queryKey: ['cohort-health-board'] });
      if (!isEdit && onCreated) onCreated(res.data.data);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.error?.message || 'Something went wrong'),
  });

  function submit() {
    setError('');
    if (!form.name.trim())  { setError('Cohort name is required'); return; }
    if (!form.org_id)        { setError('Please select an organization'); return; }
    mutation.mutate({
      name:                      form.name.trim(),
      org_id:                    form.org_id,
      program_type:              form.program_type,
      start_date:                form.start_date || undefined,
      end_date:                  form.end_date   || undefined,
      enrollment_capacity:       form.enrollment_capacity ? parseInt(form.enrollment_capacity) : undefined,
      internal_notes:            form.internal_notes || undefined,
      pre_assessment_open:       form.pre_assessment_open  || undefined,
      pre_assessment_close:      form.pre_assessment_close || undefined,
      content_access_start:      form.content_access_start || undefined,
      content_access_end:        form.content_access_end   || undefined,
      post_program_access_days:  form.post_program_access_days ? parseInt(form.post_program_access_days) : 30,
    });
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div
        initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-2xl"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(170,120,166,0.2)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: '1px solid rgba(170,120,166,0.1)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(170,120,166,0.14)', border: '1px solid rgba(170,120,166,0.25)' }}>
            <GraduationCap size={17} style={{ color: '#aa78a6' }} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-white leading-tight">
              {isEdit ? 'Edit Cohort' : 'New Cohort'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#6a5880' }}>
              {isEdit ? `Editing ${cohort.name}` : 'Configure and assign to an organization'}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#5a4870' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
            onMouseLeave={e => e.currentTarget.style.color = '#5a4870'}>
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Organization */}
          <OrgSelector
            value={form.org_id}
            onChange={v => set('org_id', v)}
            orgs={orgs}
            loading={orgsLoading} />

          {/* Name */}
          <Field label="Cohort Name" required>
            <InputEl
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g., Leadership Cohort Q3 2026" />
          </Field>

          {/* Program type */}
          <Field label="Program Type">
            <SelectEl value={form.program_type} onChange={e => set('program_type', e.target.value)}>
              {PROGRAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </SelectEl>
          </Field>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <InputEl type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </Field>
            <Field label="End Date">
              <InputEl type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </Field>
          </div>

          {/* Capacity */}
          <Field label="Enrollment Capacity" hint="Leave blank for unlimited">
            <InputEl
              type="number" min="1"
              value={form.enrollment_capacity}
              onChange={e => set('enrollment_capacity', e.target.value)}
              placeholder="e.g., 30" />
          </Field>

          {/* Advanced toggle */}
          <button
            onClick={() => setAdv(s => !s)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{
              background: showAdvanced ? 'rgba(170,120,166,0.06)' : 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(170,120,166,0.12)',
              color: '#7060a0',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#aa78a6'}
            onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
            <span>Assessment &amp; Access Windows</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{showAdvanced ? '▲ COLLAPSE' : '▼ EXPAND'}</span>
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Pre-Assessment Opens">
                      <InputEl type="datetime-local" value={form.pre_assessment_open} onChange={e => set('pre_assessment_open', e.target.value)} />
                    </Field>
                    <Field label="Pre-Assessment Closes">
                      <InputEl type="datetime-local" value={form.pre_assessment_close} onChange={e => set('pre_assessment_close', e.target.value)} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Content Access Start">
                      <InputEl type="datetime-local" value={form.content_access_start} onChange={e => set('content_access_start', e.target.value)} />
                    </Field>
                    <Field label="Content Access End">
                      <InputEl type="datetime-local" value={form.content_access_end} onChange={e => set('content_access_end', e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Post-Program Access (days)">
                    <InputEl type="number" min="0" value={form.post_program_access_days} onChange={e => set('post_program_access_days', e.target.value)} placeholder="30" />
                  </Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notes */}
          <Field label="Internal Notes">
            <textarea
              value={form.internal_notes}
              onChange={e => set('internal_notes', e.target.value)}
              rows={2}
              placeholder="Visible only to admins…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(170,120,166,0.18)',
                color: '#f0e8fc',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.18)'}
            />
          </Field>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(224,80,101,0.08)', border: '1px solid rgba(224,80,101,0.22)', color: '#e05065' }}>
              <AlertCircle size={14} className="flex-shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button
            onClick={submit}
            disabled={mutation.isPending || !form.name.trim() || !form.org_id}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {mutation.isPending
              ? <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
              : <Check size={15} />}
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Cohort'}
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function CohortsPage() {
  const [search, setSearch]       = useState('');
  const [searchParams]            = useSearchParams();
  const [statusFilter, setStatus] = useState(searchParams.get('status') || '');
  const [modal, setModal]         = useState(null); // null | { type: 'create'|'edit', cohort? }
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['cohorts', search, statusFilter],
    queryFn: () =>
      api.get('/cohorts', { params: { search, status: statusFilter || undefined, limit: 50 } }).then(r => r.data),
  });

  function handleCreated(cohort) {
    if (cohort?.id) navigate(`/admin/cohorts/${cohort.id}`);
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 page-enter">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>Cohorts</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7060a0' }}>{data?.meta?.total ?? 0} total cohorts</p>
        </div>
        <button onClick={() => setModal({ type: 'create' })} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> New Cohort
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5a4870' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search cohorts…" className="input-field pl-9 text-sm w-full" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="input-field w-40 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading
          ? [...Array(6)].map((_, i) => <div key={i} className="glass-card h-52 animate-pulse" />)
          : data?.data?.map((cohort, i) => {
              const st = STATUS_STYLES[cohort.status] || STATUS_STYLES.archived;
              const hc = HEALTH_COLORS[cohort.health_label] || '#64748b';
              return (
                <motion.div
                  key={cohort.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass-card-hover p-5 cursor-pointer group relative"
                  onClick={() => navigate(`/admin/cohorts/${cohort.id}`)}>

                  {/* Edit button — top-right on hover */}
                  <button
                    onClick={e => { e.stopPropagation(); setModal({ type: 'edit', cohort }); }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: '#7060a0' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.15)'; e.currentTarget.style.color = '#f0e8fc'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7060a0'; }}>
                    <Edit2 size={13} />
                  </button>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize"
                      style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>
                      {cohort.status}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs ml-auto mr-6" style={{ color: '#5a4870' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: hc }} />
                      {cohort.health_label || 'grey'}
                    </div>
                  </div>

                  <h3 className="font-bold text-white mb-0.5 line-clamp-1 pr-2">{cohort.name}</h3>
                  <p className="text-xs mb-4" style={{ color: '#5a4870' }}>
                    {cohort.organizations?.display_name} · <span style={{ color: '#3a3050' }}>{cohort.cohort_code}</span>
                  </p>

                  <div className="flex items-center justify-between text-xs" style={{ color: '#7060a0' }}>
                    <span className="flex items-center gap-1.5">
                      <Users size={11} />{cohort.enrollment_count ?? 0} enrolled
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={11} />{cohort.end_date ? format(parseISO(cohort.end_date), 'MMM d, yyyy') : '—'}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 flex items-center justify-between"
                    style={{ borderTop: '1px solid rgba(170,120,166,0.08)' }}>
                    <span className="text-xs capitalize" style={{ color: '#4a3860' }}>
                      {cohort.program_type?.replace(/_/g, ' ')}
                    </span>
                    <ChevronRight size={14} style={{ color: '#3a3050' }} />
                  </div>
                </motion.div>
              );
            })
        }
      </div>

      {!isLoading && data?.data?.length === 0 && (
        <div className="glass-card p-16 text-center">
          <GraduationCap size={44} className="mx-auto mb-4" style={{ color: '#2a2040' }} />
          <p className="font-semibold" style={{ color: '#5a4870' }}>No cohorts found</p>
          <p className="text-sm mt-1" style={{ color: '#3a3050' }}>Create your first cohort to get started</p>
          <button onClick={() => setModal({ type: 'create' })}
            className="btn-primary mt-5 text-sm flex items-center gap-2 mx-auto">
            <Plus size={15} /> Create Cohort
          </button>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal?.type === 'create' && (
          <CohortModal mode="create" onClose={() => setModal(null)} onCreated={handleCreated} />
        )}
        {modal?.type === 'edit' && modal.cohort && (
          <CohortModal mode="edit" cohort={modal.cohort} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
