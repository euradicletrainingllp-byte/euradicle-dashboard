import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Brain, Target, Users, Star, Sliders, X, Check, AlertCircle,
  Edit2, Trash2, Eye, EyeOff, Clock, BarChart2, FileText,
  AlignLeft, Hash, List, Search, ChevronRight, Share2, Building2, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import api from '../../lib/api';
import { useThemeStore } from '../../store/themeStore';

function ModalBackdrop({ onClose, children }) {
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 9999, background: 'rgba(8,8,18,0.88)', backdropFilter: 'blur(6px)' }}>
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6"
        onClick={e => e.target === e.currentTarget && onClose()}>
        {children}
      </div>
    </motion.div>,
    document.body
  );
}

const ASSESSMENT_TYPES = [
  { value: 'personality',      label: 'Personality',      icon: Brain,   color: '#aa78a6', bg: 'rgba(170,120,166,0.12)' },
  { value: 'behavioral',       label: 'Behavioral',       icon: Target,  color: '#6496dc', bg: 'rgba(100,150,220,0.12)' },
  { value: 'leadership_style', label: 'Leadership Style', icon: Star,    color: '#c89650', bg: 'rgba(200,150,80,0.12)'  },
  { value: '360_feedback',     label: '360° Feedback',    icon: Users,   color: '#64c878', bg: 'rgba(100,200,120,0.12)' },
  { value: 'custom',           label: 'Custom',           icon: Sliders, color: '#64c8b4', bg: 'rgba(100,200,180,0.12)' },
];
const TYPE_MAP = Object.fromEntries(ASSESSMENT_TYPES.map(t => [t.value, t]));

const Q_TYPES = [
  { value: 'mcq',          label: 'Multiple Choice', icon: List      },
  { value: 'rating_scale', label: 'Rating Scale',    icon: Sliders   },
  { value: 'open_text',    label: 'Open-Ended',      icon: AlignLeft },
  { value: 'likert',       label: 'Likert Scale',    icon: Hash      },
];

function FL({ children, required }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7a6898' }}>
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}
const iBase = {
  className: 'w-full px-3 py-2.5 rounded-xl text-sm outline-none',
  style: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: 'var(--text-heading)', colorScheme: 'dark' },
  onFocus: e => (e.target.style.borderColor = 'rgba(170,120,166,0.5)'),
  onBlur: e => (e.target.style.borderColor = 'rgba(170,120,166,0.18)'),
};
function FInput({ label, required, ...p }) {
  return <div><FL required={required}>{label}</FL><input {...iBase} {...p} /></div>;
}
function FTextarea({ label, required, rows = 3, ...p }) {
  return (
    <div>
      <FL required={required}>{label}</FL>
      <textarea rows={rows} {...iBase} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none" {...p} />
    </div>
  );
}

function QuestionEditor({ q, onChange, onRemove }) {
  const [options, setOptions] = useState(q.options || ['', '']);

  function updateOption(idx, val) {
    const next = [...options]; next[idx] = val; setOptions(next);
    onChange({ ...q, options: next });
  }
  function addOption() {
    const next = [...options, '']; setOptions(next); onChange({ ...q, options: next });
  }
  function removeOption(idx) {
    const next = options.filter((_, i) => i !== idx); setOptions(next); onChange({ ...q, options: next });
  }

  const LIKERT = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

  return (
    <div className="rounded-xl p-4 space-y-3"
      style={{ background: 'rgba(170,120,166,0.04)', border: '1px solid rgba(170,120,166,0.12)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {Q_TYPES.map(qt => {
            const Icon = qt.icon;
            const active = q.type === qt.value;
            return (
              <button key={qt.value} onClick={() => onChange({ ...q, type: qt.value })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: active ? 'rgba(170,120,166,0.2)' : 'transparent', color: active ? '#c8a0c4' : '#6a5880', border: `1px solid ${active ? 'rgba(170,120,166,0.35)' : 'transparent'}` }}>
                <Icon size={12} /> {qt.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input type="number" min="0" max="100" value={q.points ?? 1}
            onChange={e => onChange({ ...q, points: parseInt(e.target.value) || 0 })}
            className="w-14 px-2 py-1.5 rounded-lg text-xs text-center outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: 'var(--text-heading)' }}
            title="Points" />
          <span className="text-xs" style={{ color: '#6a5880' }}>pts</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={q.required ?? true} onChange={e => onChange({ ...q, required: e.target.checked })} className="w-3.5 h-3.5 accent-purple-500" />
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Required</span>
          </label>
          <button onClick={onRemove} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#e05065'}
            onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}><X size={13} /></button>
        </div>
      </div>

      <textarea value={q.text || ''} rows={2} onChange={e => onChange({ ...q, text: e.target.value })}
        placeholder="Question text…"
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.14)', color: 'var(--text-heading)' }}
        onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.4)'}
        onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.14)'} />

      {q.type === 'mcq' && (
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(170,120,166,0.12)', color: '#8070a0' }}>
                {String.fromCharCode(65 + idx)}
              </div>
              <input value={opt} onChange={e => updateOption(idx, e.target.value)} placeholder={`Option ${idx + 1}`}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.12)', color: 'var(--text-heading)' }}
                onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.35)'}
                onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.12)'} />
              {options.length > 2 && (
                <button onClick={() => removeOption(idx)} className="text-xs transition-colors" style={{ color: '#6a5880' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#e05065'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6a5880'}><X size={12} /></button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button onClick={addOption} className="text-xs flex items-center gap-1.5 mt-1 transition-colors" style={{ color: 'var(--text-faint)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#c8a0c4'}
              onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
              <Plus size={12} /> Add option
            </button>
          )}
        </div>
      )}

      {q.type === 'likert' && (
        <div className="space-y-1.5">
          <p className="text-xs" style={{ color: '#6a5880' }}>5-point Likert scale:</p>
          <div className="flex flex-wrap gap-1.5">
            {LIKERT.map((l, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs"
                style={{ background: 'rgba(170,120,166,0.1)', color: '#8070a0', border: '1px solid rgba(170,120,166,0.15)' }}>
                {i + 1}. {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {q.type === 'rating_scale' && (
        <div className="flex items-center gap-3 flex-wrap">
          {[['Min', 'scale_min', 1], ['Max', 'scale_max', 5]].map(([lbl, key, def]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{lbl}</span>
              <input type="number" value={q[key] ?? def} onChange={e => onChange({ ...q, [key]: parseInt(e.target.value) })}
                className="w-14 px-2 py-1.5 rounded-lg text-xs text-center outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: 'var(--text-heading)' }} />
            </div>
          ))}
          <input value={q.scale_label_min || ''} onChange={e => onChange({ ...q, scale_label_min: e.target.value })}
            placeholder="Low label" className="px-3 py-1.5 rounded-lg text-xs outline-none w-24"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: 'var(--text-heading)' }} />
          <input value={q.scale_label_max || ''} onChange={e => onChange({ ...q, scale_label_max: e.target.value })}
            placeholder="High label" className="px-3 py-1.5 rounded-lg text-xs outline-none w-24"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.18)', color: 'var(--text-heading)' }} />
        </div>
      )}

      {q.type === 'open_text' && (
        <p className="text-xs" style={{ color: '#6a5880' }}>Participants will see a free-form text area.</p>
      )}
    </div>
  );
}

function SectionEditor({ section, onChange, onRemove, idx }) {
  const [collapsed, setCollapsed] = useState(false);

  function updateQ(qi, updated) {
    const qs = [...section.questions]; qs[qi] = updated; onChange({ ...section, questions: qs });
  }
  function addQ() {
    onChange({ ...section, questions: [...section.questions, { id: crypto.randomUUID(), type: 'mcq', text: '', options: ['', ''], required: true, points: 1 }] });
  }
  function removeQ(qi) {
    onChange({ ...section, questions: section.questions.filter((_, i) => i !== qi) });
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(170,120,166,0.18)', background: 'rgba(170,120,166,0.03)' }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'rgba(170,120,166,0.06)', borderBottom: collapsed ? 'none' : '1px solid rgba(170,120,166,0.1)' }}>
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: 'rgba(170,120,166,0.2)', color: '#c8a0c4' }}>{idx + 1}</div>
        <input value={section.title} onChange={e => onChange({ ...section, title: e.target.value })}
          placeholder={`Section ${idx + 1} title`}
          className="flex-1 bg-transparent outline-none text-sm font-semibold" style={{ color: 'var(--text-heading)' }} />
        <span className="text-xs" style={{ color: '#6a5880' }}>{section.questions.length}Q</span>
        <button onClick={() => setCollapsed(c => !c)} className="p-1 transition-colors" style={{ color: '#6a5880' }}>
          {collapsed ? <Plus size={14} /> : <X size={14} />}
        </button>
        <button onClick={onRemove} className="p-1 transition-colors" style={{ color: '#6a5880' }}
          onMouseEnter={e => e.currentTarget.style.color = '#e05065'}
          onMouseLeave={e => e.currentTarget.style.color = '#6a5880'}><Trash2 size={13} /></button>
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="p-4 space-y-3">
              <FTextarea label="Section instructions (optional)" rows={1}
                value={section.instructions || ''} onChange={e => onChange({ ...section, instructions: e.target.value })}
                placeholder="Optional instructions…" />
              {section.questions.map((q, qi) => (
                <QuestionEditor key={q.id} q={q}
                  onChange={updated => updateQ(qi, updated)}
                  onRemove={() => removeQ(qi)} />
              ))}
              <button onClick={addQ}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                style={{ background: 'rgba(170,120,166,0.06)', color: '#8070a0', border: '1px dashed rgba(170,120,166,0.2)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.2)'}>
                <Plus size={14} /> Add Question
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const EMPTY_ASMT = {
  title: '', description: '', assessment_type: 'behavioral',
  instructions: '', timer_minutes: '', max_attempts: '1',
  allow_save_resume: true, shuffle_questions: false, show_progress_bar: true,
  sections: [],
};

function AssessmentModal({ assessment, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!assessment;

  // Fetch full assessment (list query omits sections/instructions/settings)
  const { data: fullAsmt } = useQuery({
    queryKey: ['assessment-full', assessment?.id],
    queryFn: () => api.get(`/assessments/${assessment.id}`).then(r => r.data.data),
    enabled: isEdit,
    staleTime: 10_000,
  });

  const [form, setForm] = useState(isEdit ? {
    title: assessment.title || '',
    description: assessment.description || '',
    assessment_type: assessment.assessment_type || 'behavioral',
    instructions: '',
    timer_minutes: assessment.timer_minutes?.toString() || '',
    max_attempts: '1',
    allow_save_resume: true,
    shuffle_questions: false,
    show_progress_bar: true,
    sections: [],
  } : { ...EMPTY_ASMT });
  const [error, setError] = useState('');

  // Re-populate form with full data once loaded
  useEffect(() => {
    if (fullAsmt) {
      setForm({
        title: fullAsmt.title || '',
        description: fullAsmt.description || '',
        assessment_type: fullAsmt.assessment_type || 'behavioral',
        instructions: fullAsmt.instructions || '',
        timer_minutes: fullAsmt.timer_minutes?.toString() || '',
        max_attempts: fullAsmt.max_attempts?.toString() || '1',
        allow_save_resume: fullAsmt.allow_save_resume ?? true,
        shuffle_questions: fullAsmt.shuffle_questions ?? false,
        show_progress_bar: fullAsmt.show_progress_bar ?? true,
        sections: fullAsmt.sections || [],
      });
    }
  }, [fullAsmt]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function addSection() {
    set('sections', [...form.sections, {
      id: crypto.randomUUID(), title: `Section ${form.sections.length + 1}`, instructions: '',
      questions: [{ id: crypto.randomUUID(), type: 'mcq', text: '', options: ['', ''], required: true, points: 1 }],
    }]);
  }
  function updateSection(i, updated) { const s = [...form.sections]; s[i] = updated; set('sections', s); }
  function removeSection(i) { set('sections', form.sections.filter((_, idx) => idx !== i)); }

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.patch(`/assessments/${assessment.id}`, data) : api.post('/assessments', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assessments-library'] }); onClose(); },
    onError: (err) => setError(err.response?.data?.error?.message || 'Failed to save'),
  });

  function submit() {
    setError('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (form.sections.length === 0) { setError('Add at least one section'); return; }
    for (const s of form.sections) {
      for (const q of s.questions) { if (!q.text?.trim()) { setError('All questions must have text'); return; } }
    }
    mutation.mutate({
      title: form.title.trim(), description: form.description || null,
      assessment_type: form.assessment_type, instructions: form.instructions || null,
      timer_minutes: form.timer_minutes ? parseInt(form.timer_minutes) : null,
      max_attempts: parseInt(form.max_attempts) || 1,
      allow_save_resume: form.allow_save_resume, shuffle_questions: form.shuffle_questions,
      show_progress_bar: form.show_progress_bar, sections: form.sections,
    });
  }

  const typeInfo = TYPE_MAP[form.assessment_type];
  const TypeIcon = typeInfo?.icon || Brain;
  const totalQs = form.sections.reduce((s, sec) => s + sec.questions.length, 0);

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-3xl"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(170,120,166,0.2)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid rgba(170,120,166,0.1)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: typeInfo?.bg, border: `1px solid ${typeInfo?.color}33` }}>
            <TypeIcon size={15} style={{ color: typeInfo?.color }} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-[var(--text-heading)]">{isEdit ? 'Edit Assessment' : 'Create Assessment'}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#6a5880' }}>
              {isEdit && !fullAsmt
                ? 'Loading…'
                : `${form.sections.length} section${form.sections.length !== 1 ? 's' : ''} · ${totalQs} question${totalQs !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-ghost)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
            onMouseLeave={e => e.currentTarget.style.color = '#5a4870'}><X size={17} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <FL required>Assessment Type</FL>
            <div className="flex flex-wrap gap-2">
              {ASSESSMENT_TYPES.map(t => {
                const Icon = t.icon;
                const active = form.assessment_type === t.value;
                return (
                  <button key={t.value} onClick={() => set('assessment_type', t.value)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: active ? t.bg : 'rgba(255,255,255,0.02)', color: active ? t.color : '#6a5880', border: `1px solid ${active ? t.color + '44' : 'rgba(170,120,166,0.1)'}` }}>
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <FInput label="Assessment Title" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Pre-Programme Leadership Readiness" />
          <FTextarea label="Description" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What this assessment measures…" />
          <FTextarea label="Participant Instructions" rows={2} value={form.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Instructions shown before participants begin…" />

          <div className="grid grid-cols-3 gap-3">
            <FInput label="Time Limit (min)" value={form.timer_minutes} onChange={e => set('timer_minutes', e.target.value)} type="number" min="1" placeholder="Unlimited" />
            <FInput label="Max Attempts" value={form.max_attempts} onChange={e => set('max_attempts', e.target.value)} type="number" min="1" />
            <div>
              <FL>Options</FL>
              <div className="space-y-2 pt-0.5">
                {[['allow_save_resume', 'Save & Resume'], ['shuffle_questions', 'Shuffle Qs'], ['show_progress_bar', 'Progress Bar']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} className="w-3.5 h-3.5 accent-purple-500" />
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{l}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <FL>Sections & Questions</FL>
              <button onClick={addSection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(170,120,166,0.12)', color: '#c8a0c4', border: '1px solid rgba(170,120,166,0.2)' }}>
                <Plus size={12} /> Add Section
              </button>
            </div>
            <div className="space-y-3">
              {form.sections.length === 0 ? (
                <div className="py-8 text-center rounded-2xl" style={{ border: '1px dashed rgba(170,120,166,0.2)' }}>
                  <FileText size={28} className="mx-auto mb-2 opacity-20" style={{ color: '#aa78a6' }} />
                  <p className="text-sm" style={{ color: '#6a5880' }}>No sections yet — add one to start building questions</p>
                </div>
              ) : form.sections.map((sec, i) => (
                <SectionEditor key={sec.id} section={sec} idx={i}
                  onChange={u => updateSection(i, u)} onRemove={() => removeSection(i)} />
              ))}
            </div>
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
          <button onClick={submit} disabled={mutation.isPending || !form.title.trim()}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {mutation.isPending ? <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" /> : <Check size={15} />}
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Assessment'}
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function hasAnswers(resp) {
  const a = resp.answers;
  return a && typeof a === 'object' && Object.keys(a).length > 0;
}

function respStatusLabel(resp) {
  if (resp.status === 'submitted' || resp.status === 'scored') return resp.status === 'scored' ? 'Scored' : 'Submitted';
  if (resp.status === 'in_progress' && !hasAnswers(resp)) return 'Not Started';
  return 'In Progress';
}

function respStatusStyle(resp) {
  const label = respStatusLabel(resp);
  if (label === 'Submitted' || label === 'Scored')
    return { bg: 'rgba(64,201,128,0.12)', color: '#40c980', border: 'rgba(64,201,128,0.25)' };
  if (label === 'In Progress')
    return { bg: 'rgba(200,150,80,0.12)', color: '#c89650', border: 'rgba(200,150,80,0.25)' };
  // Not Started
  return { bg: 'rgba(90,72,112,0.15)', color: '#8a78a8', border: 'rgba(90,72,112,0.25)' };
}

function exportResponsesXLSXFromModal(assessmentTitle, sections, responses) {
  const allQuestions = [];
  (sections || []).forEach((sec, si) => {
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

  // Sheet 1: Summary
  const summaryRows = [['Name', 'Email', 'Designation', 'Department', 'Status', 'Score', 'Attempt #', 'Started At', 'Submitted At', 'Cohort']];
  responses.forEach(r => {
    const u = r.enrollment?.user || {};
    const label = respStatusLabel(r);
    summaryRows.push([
      u.name || u.display_name || '',
      u.email || '',
      u.designation || '',
      u.department || '',
      label,
      r.total_score != null ? r.total_score : '',
      r.attempt_number || '',
      r.started_at ? format(new Date(r.started_at), 'dd/MM/yyyy HH:mm') : '',
      r.submitted_at ? format(new Date(r.submitted_at), 'dd/MM/yyyy HH:mm') : '',
      r._cohortName || '',
    ]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [22, 28, 20, 18, 14, 8, 10, 18, 18, 22].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // Sheet 2: Question Responses (only submitted/scored)
  const submitted = responses.filter(r => r.status === 'submitted' || r.status === 'scored');
  if (allQuestions.length && submitted.length) {
    const qRows = [
      ['Name', 'Email', ...allQuestions.map(q => q.label)],
      ['', '',       ...allQuestions.map(q => `[${q.section}] ${q.text}`)],
    ];
    submitted.forEach(r => {
      const u = r.enrollment?.user || {};
      const answers = r.answers || {};
      const row = [u.name || u.display_name || '', u.email || ''];
      allQuestions.forEach(q => {
        const ans = answers[q.key];
        if (ans == null || ans === '') { row.push(''); return; }
        if (q.type === 'mcq') {
          const idx = Number(ans);
          const opt = q.options[idx];
          row.push(opt != null ? `${String.fromCharCode(65 + idx)}. ${opt}` : String(ans));
        } else {
          row.push(String(ans));
        }
      });
      qRows.push(row);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(qRows);
    ws2['!cols'] = [22, 28, ...allQuestions.map(() => ({ wch: 24 }))];
    XLSX.utils.book_append_sheet(wb, ws2, 'Question Responses');
  }

  const safe = assessmentTitle.replace(/[^a-z0-9]/gi, '_');
  XLSX.writeFile(wb, `${safe}_responses.xlsx`);
}

// ── Answer Detail Panel (shown inline below a response row) ──────────────────
function AnswerDetailPanel({ resp, sections }) {
  const answers = resp.answers || {};
  if (!sections || sections.length === 0)
    return <p className="text-xs italic py-3 text-center" style={{ color: 'var(--text-ghost)' }}>No question structure available for this assessment.</p>;

  return (
    <div className="mt-3 space-y-4 pt-3" style={{ borderTop: '1px solid rgba(170,120,166,0.1)' }}>
      {sections.map((sec, si) => (
        <div key={si}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#aa78a6' }}>
            {sec.title || `Section ${si + 1}`}
          </p>
          <div className="space-y-2">
            {(sec.questions || []).map((q, qi) => {
              const qKey = q.id != null ? q.id : qi;
              const answer = answers[qKey];
              const unanswered = answer == null || answer === '';
              return (
                <div key={qi} className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${unanswered ? 'rgba(170,120,166,0.07)' : 'rgba(170,120,166,0.14)'}` }}>
                  <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    <span className="font-bold mr-1.5" style={{ color: 'var(--text-ghost)' }}>{si + 1}.{qi + 1}</span>
                    {q.text}
                  </p>
                  {unanswered ? (
                    <p className="text-xs italic" style={{ color: 'var(--text-ghost)' }}>No answer provided</p>
                  ) : q.type === 'mcq' ? (
                    <div className="text-xs px-3 py-1.5 rounded-lg inline-block"
                      style={{ background: 'rgba(100,150,220,0.12)', color: '#8ab8f0', border: '1px solid rgba(100,150,220,0.2)' }}>
                      {String.fromCharCode(65 + Number(answer))}. {(q.options || [])[Number(answer)] ?? answer}
                    </div>
                  ) : (
                    <div className="text-xs px-3 py-1.5 rounded-lg whitespace-pre-wrap"
                      style={{ background: 'rgba(170,120,166,0.08)', color: 'var(--text-secondary)' }}>
                      {String(answer)}
                    </div>
                  )}
                  {q.type === 'mcq' && q.correct_option != null && (
                    <p className="text-xs mt-1.5" style={{ color: Number(answer) === q.correct_option ? '#40c980' : '#e05065' }}>
                      {Number(answer) === q.correct_option ? '✓ Correct' : `✗ Correct answer: ${String.fromCharCode(65 + q.correct_option)}. ${(q.options || [])[q.correct_option]}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResponsesModal({ assessment, onClose }) {
  const [selectedCohort, setSelectedCohort] = useState(null);
  const [expandedResp, setExpandedResp] = useState(null); // response id whose answers are shown

  // Fetch responses (now includes answers + started_at)
  const { data: respData, isLoading } = useQuery({
    queryKey: ['assessment-responses', assessment.id],
    queryFn: () => api.get(`/assessments/${assessment.id}/responses`).then(r => r.data),
    staleTime: 30_000,
  });

  // Fetch full assessment detail to get sections (library list only returns summary fields)
  const { data: fullDetail } = useQuery({
    queryKey: ['assessment-detail', assessment.id],
    queryFn: () => api.get(`/assessments/${assessment.id}`).then(r => r.data.data),
    staleTime: 60_000,
  });
  const sections = fullDetail?.sections || assessment.sections || [];

  const assignments = respData?.assignments || [];
  const allResponses = respData?.data || [];

  const byAssignment = assignments.reduce((acc, asg) => {
    acc[asg.id] = {
      cohort: asg.cohorts,
      responses: allResponses
        .filter(r => r.assignment_id === asg.id)
        .map(r => ({ ...r, _cohortName: asg.cohorts?.name || '' })),
    };
    return acc;
  }, {});

  const handleExport = (cohortId) => {
    const info = byAssignment[cohortId];
    if (!info) return;
    exportResponsesXLSXFromModal(assessment.title, sections, info.responses);
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-2xl"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.7)', border: '1px solid rgba(170,120,166,0.2)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(170,120,166,0.1)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(100,200,120,0.12)', border: '1px solid rgba(100,200,120,0.2)' }}>
            <BarChart2 size={15} style={{ color: '#64c878' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-[var(--text-heading)]">Participant Responses</h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-ghost)' }}>{assessment.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-ghost)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-heading)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-ghost)'}><X size={17} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(170,120,166,0.07)' }} />)}</div>
          ) : assignments.length === 0 ? (
            <div className="py-12 text-center">
              <BarChart2 size={36} className="mx-auto mb-3 opacity-20" style={{ color: '#aa78a6' }} />
              <p style={{ color: 'var(--text-faint)' }}>This assessment has not been assigned to any cohort yet.</p>
            </div>
          ) : !selectedCohort ? (
            // ── Cohort list ──
            <div className="space-y-3">
              <p className="text-xs mb-3" style={{ color: 'var(--text-ghost)' }}>Select a cohort to view responses:</p>
              {assignments.map(asg => {
                const info = byAssignment[asg.id];
                const total = info?.responses?.length || 0;
                const submitted = info?.responses?.filter(r => r.status === 'submitted' || r.status === 'scored').length || 0;
                const notStarted = info?.responses?.filter(r => r.status === 'in_progress' && !hasAnswers(r)).length || 0;
                const inProg = total - submitted - notStarted;
                return (
                  <button key={asg.id} onClick={() => { setSelectedCohort(asg.id); setExpandedResp(null); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left"
                    style={{ background: 'rgba(170,120,166,0.05)', border: '1px solid rgba(170,120,166,0.12)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.12)'}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>{info?.cohort?.name || 'Cohort'}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-ghost)' }}>{info?.cohort?.cohort_code}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-shrink-0">
                      <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(64,201,128,0.1)', color: '#40c980' }}>{submitted} submitted</span>
                      {inProg > 0 && <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(200,150,80,0.1)', color: '#c89650' }}>{inProg} in progress</span>}
                      {notStarted > 0 && <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(90,72,112,0.12)', color: '#8a78a8' }}>{notStarted} not started</span>}
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-ghost)', flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          ) : (() => {
            // ── Response list for selected cohort ──
            const info = byAssignment[selectedCohort];
            const cohortResponses = info?.responses || [];
            return (
              <div className="space-y-3">
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => { setSelectedCohort(null); setExpandedResp(null); }}
                    className="flex items-center gap-1.5 text-sm transition-colors" style={{ color: 'var(--text-faint)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-heading)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
                    ← {info?.cohort?.name || 'Back'}
                  </button>
                  {cohortResponses.length > 0 && (
                    <button onClick={() => handleExport(selectedCohort)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                      style={{ background: 'rgba(100,150,220,0.1)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.22)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,150,220,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,150,220,0.1)'}>
                      <Download size={12} /> Export Excel
                    </button>
                  )}
                </div>

                {cohortResponses.length === 0 ? (
                  <div className="py-10 text-center">
                    <Brain size={32} className="mx-auto mb-3 opacity-20" style={{ color: '#aa78a6' }} />
                    <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>No responses yet for this cohort.</p>
                  </div>
                ) : cohortResponses.map(resp => {
                  const user = resp.enrollment?.user || {};
                  const isExpanded = expandedResp === resp.id;
                  const canView = (resp.status === 'submitted' || resp.status === 'scored') && hasAnswers(resp);
                  const st = respStatusStyle(resp);
                  const label = respStatusLabel(resp);

                  return (
                    <div key={resp.id} className="rounded-xl overflow-hidden"
                      style={{ background: 'rgba(170,120,166,0.04)', border: `1px solid ${isExpanded ? 'rgba(170,120,166,0.25)' : 'rgba(170,120,166,0.1)'}` }}>
                      <div className="flex items-center gap-3 p-4">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg,#aa78a6,#6040a0)', color: '#fff' }}>
                          {(user.name || user.display_name || '?')[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-heading)' }}>
                            {user.name || user.display_name || 'Participant'}
                          </p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-ghost)' }}>
                            {user.email}{user.designation ? ` · ${user.designation}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {resp.submitted_at && (
                            <p className="text-xs hidden sm:block" style={{ color: 'var(--text-ghost)' }}>
                              {format(new Date(resp.submitted_at), 'dd MMM yyyy')}
                            </p>
                          )}
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                            {label}
                          </span>
                          {resp.total_score != null && (
                            <span className="text-xs font-bold px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(100,200,120,0.1)', color: '#64c878' }}>
                              {resp.total_score}pts
                            </span>
                          )}
                          {canView && (
                            <button onClick={() => setExpandedResp(isExpanded ? null : resp.id)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                              style={{ color: isExpanded ? '#f0e8fc' : '#aa78a6', background: isExpanded ? 'rgba(170,120,166,0.2)' : 'rgba(170,120,166,0.07)', border: '1px solid rgba(170,120,166,0.2)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.18)'; e.currentTarget.style.color = '#f0e8fc'; }}
                              onMouseLeave={e => { if (!isExpanded) { e.currentTarget.style.background = 'rgba(170,120,166,0.07)'; e.currentTarget.style.color = '#aa78a6'; } }}>
                              <Eye size={11} /> {isExpanded ? 'Hide' : 'Answers'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded answer panel */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            style={{ overflow: 'hidden', borderTop: '1px solid rgba(170,120,166,0.1)' }}>
                            <div className="px-4 pb-4">
                              <AnswerDetailPanel resp={resp} sections={sections} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(170,120,166,0.1)' }}>
          <button onClick={onClose} className="btn-ghost w-full text-sm">Close</button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

function DeleteAsmtModal({ item, onClose }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api.delete(`/assessments/${item.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assessments-library'] }); onClose(); },
  });
  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22 }}
        className="glass-card w-full max-w-sm p-6 space-y-4"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.65)', border: '1px solid rgba(224,80,101,0.22)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(224,80,101,0.1)', border: '1px solid rgba(224,80,101,0.25)' }}>
            <Trash2 size={16} style={{ color: '#e05065' }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: 'var(--text-heading)' }}>Delete Assessment</h3>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>This will archive it permanently</p>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          "<strong style={{ color: 'var(--text-heading)' }}>{item.title}</strong>" and all response data will be archived.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={() => del.mutate()} disabled={del.isPending}
            className="flex-1 text-sm py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'rgba(224,80,101,0.12)', color: '#e05065', border: '1px solid rgba(224,80,101,0.25)' }}>
            {del.isPending ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}


// ── Assign Assessment to Cohort Modal ────────────────────────────────────────
function AssignToCohortModal({ assessment, onClose }) {
  const qc = useQueryClient();
  const [cohortId, setCohortId] = useState('');
  const [accessOpen, setAccessOpen] = useState('');
  const [accessClose, setAccessClose] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const [visOrgCompletion, setVisOrgCompletion] = useState(true);
  const [visOrgScores, setVisOrgScores] = useState(false);
  const [visParticipantScore, setVisParticipantScore] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: cohortsData } = useQuery({
    queryKey: ['cohorts-active'],
    queryFn: () => api.get('/cohorts', { params: { status: 'active', limit: 100 } }).then(r => r.data),
    staleTime: 30_000,
  });
  const activeCohorts = cohortsData?.data || [];

  const assign = useMutation({
    mutationFn: () => api.post(`/cohorts/${cohortId}/assessments`, {
      assessment_id: assessment.id,
      access_open: accessOpen || undefined,
      access_close: accessClose || undefined,
      mandatory,
      visibility_org_admin_completion: visOrgCompletion,
      visibility_org_admin_scores: visOrgScores,
      visibility_participant_score: visParticipantScore,
      visibility_participant_report: false,
      visibility_org_admin_responses: false,
    }),
    onSuccess: () => {
      setSuccess('Assigned successfully!');
      qc.invalidateQueries({ queryKey: ['cohort-assessments'] });
      setTimeout(onClose, 1200);
    },
    onError: err => setError(err.response?.data?.error?.message || 'Failed to assign'),
  });

  const handleSubmit = () => {
    if (!cohortId) { setError('Please select a cohort'); return; }
    setError(''); assign.mutate();
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: 'rgba(18,10,30,0.97)', border: '1px solid rgba(170,120,166,0.25)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--text-heading)] text-lg">Assign to Cohort</h2>
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-faint)' }}>{assessment.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#6a5880' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c8a0c4'}
            onMouseLeave={e => e.currentTarget.style.color = '#6a5880'}><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Cohort *</label>
            <select value={cohortId} onChange={e => setCohortId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }}>
              <option value="">Select active cohort…</option>
              {activeCohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.cohort_code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Access Opens</label>
              <input type="datetime-local" value={accessOpen} onChange={e => setAccessOpen(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Access Closes</label>
              <input type="datetime-local" value={accessClose} onChange={e => setAccessClose(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="block text-xs font-semibold" style={{ color: '#c8a0c4' }}>Visibility & Settings</label>
            {[
              { label: 'Mandatory for participants', val: mandatory, set: setMandatory },
              { label: 'Org admin can see completion status', val: visOrgCompletion, set: setVisOrgCompletion },
              { label: 'Org admin can see scores', val: visOrgScores, set: setVisOrgScores },
              { label: 'Participants can see their score', val: visParticipantScore, set: setVisParticipantScore },
            ].map(({ label, val, set }) => (
              <button key={label} type="button" onClick={() => set(v => !v)}
                className="flex items-center gap-2.5 w-full text-left text-xs transition-colors"
                style={{ color: val ? '#c8a0c4' : '#5a4870' }}>
                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: val ? 'rgba(170,120,166,0.25)' : 'rgba(255,255,255,0.04)', border: `1px solid ${val ? 'rgba(170,120,166,0.5)' : 'rgba(170,120,166,0.15)'}` }}>
                  {val && <Check size={10} style={{ color: '#c8a0c4' }} />}
                </div>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(224,80,101,0.1)', color: '#e05065', border: '1px solid rgba(224,80,101,0.2)' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(64,201,128,0.1)', color: '#40c980', border: '1px solid rgba(64,201,128,0.2)' }}>
            <Check size={13} /> {success}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2.5">Cancel</button>
          <button onClick={handleSubmit} disabled={assign.isPending}
            className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2">
            {assign.isPending ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Share2 size={14} />}
            {assign.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

function AssessmentCard({ item, onEdit, onDelete, onToggle, onViewResponses, onAssign }) {
  const t = TYPE_MAP[item.assessment_type] || ASSESSMENT_TYPES[0];
  const Icon = t.icon;
  const isPublished = item.library_status === 'published';
  const totalQs = (item.sections || []).reduce((s, sec) => s + (sec.questions?.length || 0), 0);

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card p-5 group flex flex-col gap-3 transition-all"
      style={{ border: '1px solid rgba(170,120,166,0.1)' }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: t.bg, border: `1px solid ${t.color}33` }}>
          <Icon size={16} style={{ color: t.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>{item.title}</h3>
          {item.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-faint)' }}>{item.description}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.color, border: `1px solid ${t.color}33` }}>{t.label}</span>
        <span className="flex items-center gap-1" style={{ color: '#6a5880' }}>
          <FileText size={11} /> {(item.sections || []).length}s · {totalQs}q
        </span>
        {item.timer_minutes && <span className="flex items-center gap-1" style={{ color: '#6a5880' }}><Clock size={11} /> {item.timer_minutes}m</span>}
      </div>

      <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid rgba(170,120,166,0.07)' }}>
        <button onClick={() => onToggle(item)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: isPublished ? 'rgba(64,201,128,0.1)' : 'rgba(200,150,80,0.1)', color: isPublished ? '#40c980' : '#c89650', border: `1px solid ${isPublished ? 'rgba(64,201,128,0.2)' : 'rgba(200,150,80,0.2)'}` }}>
          {isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
          {isPublished ? 'Published' : 'Draft'}
        </button>
        <button onClick={() => onViewResponses(item)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'rgba(100,200,120,0.08)', color: '#64c878', border: '1px solid rgba(100,200,120,0.18)' }}>
          <BarChart2 size={12} /> Responses
        </button>
        <button onClick={() => onAssign(item)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'rgba(100,150,220,0.08)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.18)' }}>
          <Share2 size={12} /> Assign
        </button>
        <div className="flex-1" />
        <button onClick={() => onEdit(item)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-colors"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#c8a0c4'}
          onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}><Edit2 size={14} /></button>
        <button onClick={() => onDelete(item)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-colors"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#e05065'}
          onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}><Trash2 size={14} /></button>
      </div>
    </motion.div>
  );
}

export default function AssessmentsPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['assessments-library', typeFilter, statusFilter],
    queryFn: () => api.get('/assessments', {
      params: { assessment_type: typeFilter || undefined, library_status: statusFilter || undefined, limit: 100 },
    }).then(r => r.data),
    staleTime: 15_000,
  });

  const items = (data?.data || []).filter(i =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase())
  );
  const total = data?.meta?.total ?? 0;
  const published = (data?.data || []).filter(i => i.library_status === 'published').length;
  const draft     = (data?.data || []).filter(i => i.library_status === 'draft').length;

  const toggleStatus = useMutation({
    mutationFn: (item) => api.patch(`/assessments/${item.id}`, { library_status: item.library_status === 'published' ? 'draft' : 'published' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessments-library'] }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 page-enter">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: 'var(--text-heading)' }}>Assessment Library</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {total} assessment{total !== 1 ? 's' : ''} · Re-usable, assignable to cohorts
          </p>
        </div>
        <button onClick={() => setModal({ type: 'create' })} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Create Assessment
        </button>
      </motion.div>

      {total > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',     value: total,     color: '#c8a0c4' },
            { label: 'Published', value: published, color: '#40c980' },
            { label: 'Draft',     value: draft,     color: '#c89650' },
            { label: 'Types',     value: new Set((data?.data || []).map(i => i.assessment_type)).size, color: '#6496dc' },
          ].map(s => (
            <div key={s.label} className="glass-card px-4 py-3" style={{ border: '1px solid rgba(170,120,166,0.1)' }}>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: '#6a5880' }}>{s.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl max-w-xs"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.15)' }}>
          <Search size={14} style={{ color: 'var(--text-faint)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assessments…"
            className="bg-transparent outline-none text-sm flex-1" style={{ color: 'var(--text-heading)' }} />
          {search && <button onClick={() => setSearch('')}><X size={12} style={{ color: 'var(--text-faint)' }} /></button>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTypeFilter('')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ background: !typeFilter ? 'rgba(170,120,166,0.2)' : 'rgba(255,255,255,0.03)', color: !typeFilter ? '#c8a0c4' : '#6a5880', border: '1px solid rgba(170,120,166,0.14)' }}>
            All Types
          </button>
          {ASSESSMENT_TYPES.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.value} onClick={() => setTypeFilter(typeFilter === t.value ? '' : t.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{ background: typeFilter === t.value ? t.bg : 'rgba(255,255,255,0.03)', color: typeFilter === t.value ? t.color : '#6a5880', border: `1px solid ${typeFilter === t.value ? t.color + '44' : 'rgba(170,120,166,0.1)'}` }}>
                <Icon size={11} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1.5">
          {['', 'published', 'draft', 'archived'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: statusFilter === s ? (s === 'published' ? 'rgba(64,201,128,0.12)' : s === 'draft' ? 'rgba(200,150,80,0.12)' : s === 'archived' ? 'rgba(112,96,160,0.1)' : 'rgba(170,120,166,0.15)') : 'transparent', color: statusFilter === s ? (s === 'published' ? '#40c980' : s === 'draft' ? '#c89650' : s === 'archived' ? '#7060a0' : '#c8a0c4') : '#6a5880', border: '1px solid rgba(170,120,166,0.1)' }}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Status'}
            </button>
          ))}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="glass-card p-5 h-44 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-16 text-center">
          <Brain size={42} className="mx-auto mb-3 opacity-20" style={{ color: '#aa78a6' }} />
          <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>No assessments found</p>
          <p className="text-sm mt-1" style={{ color: '#6a5880' }}>
            {search || typeFilter || statusFilter ? 'Try adjusting filters' : 'Create your first re-usable assessment'}
          </p>
          {!search && !typeFilter && !statusFilter && (
            <button onClick={() => setModal({ type: 'create' })} className="btn-primary mt-5 flex items-center gap-2 mx-auto text-sm">
              <Plus size={15} /> Create Assessment
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {items.map(item => (
              <AssessmentCard key={item.id} item={item}
                onEdit={i => setModal({ type: 'edit', item: i })}
                onDelete={i => setModal({ type: 'delete', item: i })}
                onToggle={i => toggleStatus.mutate(i)}
                onViewResponses={i => setModal({ type: 'responses', item: i })}
                onAssign={i => setModal({ type: 'assign', item: i })} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {modal?.type === 'create'    && <AssessmentModal onClose={() => setModal(null)} />}
        {modal?.type === 'edit'      && <AssessmentModal assessment={modal.item} onClose={() => setModal(null)} />}
        {modal?.type === 'delete'    && <DeleteAsmtModal item={modal.item} onClose={() => setModal(null)} />}
        {modal?.type === 'responses' && <ResponsesModal assessment={modal.item} onClose={() => setModal(null)} />}
        {modal?.type === 'assign'    && <AssignToCohortModal assessment={modal.item} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}
