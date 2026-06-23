import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, BookOpen, Video, FileText, Link as LinkIcon,
  Headphones, Layers, Package, Edit2, Trash2, X, Check, AlertCircle,
  Eye, EyeOff, Tag, Clock, ChevronDown, ChevronUp, Star, Globe,
  ExternalLink, Share2, Building2, FileEdit, PlusCircle, Columns,
} from 'lucide-react';
import api from '../../lib/api';

// ── Portal backdrop ────────────────────────────────────────────────────────────
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

// ── Content types config ───────────────────────────────────────────────────────
const CONTENT_TYPES = [
  { value: 'article',           label: 'Article',         icon: FileText,  color: '#6496dc', bg: 'rgba(100,150,220,0.12)' },
  { value: 'video',             label: 'Video',           icon: Video,     color: '#40c980', bg: 'rgba(64,201,128,0.12)'  },
  { value: 'case_study',        label: 'Case Study',      icon: Star,      color: '#c89650', bg: 'rgba(200,150,80,0.12)'  },
  { value: 'presentation',      label: 'Presentation',    icon: Layers,    color: '#aa78a6', bg: 'rgba(170,120,166,0.12)' },
  { value: 'toolkit',           label: 'Toolkit',         icon: Package,   color: '#64c8b4', bg: 'rgba(100,200,180,0.12)' },
  { value: 'external_link',     label: 'External Link',   icon: Globe,     color: '#c86464', bg: 'rgba(200,100,100,0.12)' },
  { value: 'audio',             label: 'Audio',           icon: Headphones,color: '#c8a0c4', bg: 'rgba(200,160,196,0.12)' },
  { value: 'reflection_prompt', label: 'Reflection',      icon: BookOpen,  color: '#d0a030', bg: 'rgba(208,160,48,0.12)'  },
];
const TYPE_MAP = Object.fromEntries(CONTENT_TYPES.map(t => [t.value, t]));

// ── Tag Input ──────────────────────────────────────────────────────────────────
function TagInput({ value = [], onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) { onChange([...value, v]); }
    setInput('');
  };
  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl min-h-[40px]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)' }}>
      {value.map(t => (
        <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ background: 'rgba(170,120,166,0.15)', color: '#c8a0c4', border: '1px solid rgba(170,120,166,0.2)' }}>
          {t}
          <button type="button" onClick={() => onChange(value.filter(x => x !== t))}><X size={9} /></button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : ''}
        className="bg-transparent outline-none text-xs flex-1 min-w-[80px]"
        style={{ color: 'var(--text-heading)' }} />
    </div>
  );
}

// ── Content Modal (Create / Edit) ──────────────────────────────────────────────
function ContentModal({ item, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!item;

  const [type, setType]         = useState(item?.content_type || 'article');
  const [title, setTitle]       = useState(item?.title || '');
  const [desc, setDesc]         = useState(item?.description || '');
  const [body, setBody]         = useState(item?.rich_text_body || '');
  const [fileUrl, setFileUrl]   = useState(item?.file_url || '');
  const [extUrl, setExtUrl]     = useState(item?.external_url || '');
  const [minutes, setMinutes]   = useState(item?.estimated_minutes || '');
  const [tagsComp, setTagsComp] = useState(item?.tags_competency || []);
  const [tagsInd, setTagsInd]   = useState(item?.tags_industry || []);
  const [tagsLvl, setTagsLvl]   = useState(item?.tags_level || []);
  const [tagsProg, setTagsProg] = useState(item?.tags_program_type || []);
  const [showTags, setShowTags] = useState(false);
  const [error, setError]       = useState('');

  // Multi-page mode (article, toolkit, case_study, reflection_prompt)
  const existingPages = item?.pages?.length ? item.pages : null;
  const [usePages, setUsePages] = useState(!!existingPages);
  const [pages, setPages]       = useState(existingPages || [{ id: 1, title: 'Page 1', body: '' }]);
  const addPage    = () => setPages(p => [...p, { id: Date.now(), title: `Page ${p.length + 1}`, body: '' }]);
  const removePage = (idx) => setPages(p => p.filter((_, i) => i !== idx));
  const updatePage = (idx, field, val) => setPages(p => p.map((pg, i) => i === idx ? { ...pg, [field]: val } : pg));

  const save = useMutation({
    mutationFn: (payload) => isEdit
      ? api.patch(`/content/${item.id}`, payload)
      : api.post('/content', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['content-library'] }); onClose(); },
    onError: err => setError(err.response?.data?.error?.message || 'Save failed'),
  });

  const handleSubmit = () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setError('');
    save.mutate({
      content_type: type,
      title: title.trim(),
      description: desc.trim() || null,
      rich_text_body: (!usePages && needsBody) ? body.trim() || null : null,
      pages: usePages ? pages.map(p => ({ ...p, title: p.title.trim(), body: p.body.trim() })) : [],
      file_url: fileUrl.trim() || null,
      external_url: extUrl.trim() || null,
      estimated_minutes: minutes ? parseInt(minutes) : null,
      tags_competency: tagsComp,
      tags_industry: tagsInd,
      tags_level: tagsLvl,
      tags_program_type: tagsProg,
    });
  };

  const needsUrl = ['external_link'].includes(type);
  const needsFile = ['presentation', 'audio'].includes(type);
  const needsBody = ['article', 'reflection_prompt', 'case_study', 'toolkit'].includes(type);
  const needsVideoUrl = ['video'].includes(type);
  const supportsPages = ['article', 'toolkit', 'case_study', 'reflection_prompt'].includes(type);

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }} transition={{ duration: 0.22 }}
        className="w-full max-w-2xl rounded-2xl p-6 space-y-5"
        style={{ background: 'rgba(18,10,30,0.97)', border: '1px solid rgba(170,120,166,0.25)' }}>

        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[var(--text-heading)] text-lg">{isEdit ? 'Edit Content' : 'Add Content'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#6a5880' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c8a0c4'}
            onMouseLeave={e => e.currentTarget.style.color = '#6a5880'}><X size={18} /></button>
        </div>

        {/* Type picker */}
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: '#c8a0c4' }}>Content Type</label>
          <div className="grid grid-cols-4 gap-2">
            {CONTENT_TYPES.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: type === t.value ? t.bg : 'rgba(255,255,255,0.03)',
                    color: type === t.value ? t.color : '#6a5880',
                    border: `1px solid ${type === t.value ? t.color + '44' : 'rgba(170,120,166,0.1)'}`,
                  }}>
                  <Icon size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Content title…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description…" rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
          </div>

          {needsBody && (
            <div className="space-y-3">
              {supportsPages && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setUsePages(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: !usePages ? 'rgba(170,120,166,0.2)' : 'rgba(255,255,255,0.03)', color: !usePages ? '#c8a0c4' : '#6a5880', border: `1px solid ${!usePages ? 'rgba(170,120,166,0.4)' : 'rgba(170,120,166,0.12)'}` }}>
                    <FileEdit size={12} /> Single Body
                  </button>
                  <button type="button" onClick={() => setUsePages(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: usePages ? 'rgba(100,200,180,0.15)' : 'rgba(255,255,255,0.03)', color: usePages ? '#64c8b4' : '#6a5880', border: `1px solid ${usePages ? 'rgba(100,200,180,0.35)' : 'rgba(170,120,166,0.12)'}` }}>
                    <Columns size={12} /> Multi-Page
                  </button>
                  {usePages && <span className="text-xs" style={{ color: 'var(--text-ghost)' }}>Participants navigate pages in-platform</span>}
                </div>
              )}

              {!usePages ? (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Content Body</label>
                  <textarea value={body} onChange={e => setBody(e.target.value)}
                    placeholder="Article content, case study text, or reflection prompt…" rows={5}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
                </div>
              ) : (
                <div className="space-y-3">
                  {pages.map((pg, idx) => (
                    <div key={pg.id} className="rounded-xl p-4 space-y-2"
                      style={{ background: 'rgba(100,200,180,0.05)', border: '1px solid rgba(100,200,180,0.15)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(100,200,180,0.12)', color: '#64c8b4' }}>Page {idx + 1}</span>
                        <input value={pg.title} onChange={e => updatePage(idx, 'title', e.target.value)}
                          placeholder="Page title…"
                          className="flex-1 px-2 py-1 rounded-lg text-xs outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.15)', color: 'var(--text-heading)' }} />
                        {pages.length > 1 && (
                          <button type="button" onClick={() => removePage(idx)}
                            className="p-1 rounded" style={{ color: '#e05065' }}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <textarea value={pg.body} onChange={e => updatePage(idx, 'body', e.target.value)}
                        placeholder="Page content…" rows={4}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.15)', color: 'var(--text-heading)' }} />
                    </div>
                  ))}
                  <button type="button" onClick={addPage}
                    className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                    style={{ color: '#64c8b4' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#90dfd4'}
                    onMouseLeave={e => e.currentTarget.style.color = '#64c8b4'}>
                    <PlusCircle size={13} /> Add Page
                  </button>
                </div>
              )}
            </div>
          )}

          {(needsUrl || needsVideoUrl) && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>
                {needsVideoUrl ? 'Video URL (YouTube/Vimeo/etc.)' : 'External URL'}
              </label>
              <input value={extUrl} onChange={e => setExtUrl(e.target.value)} placeholder="https://…"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
            </div>
          )}

          {needsFile && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>File URL</label>
              <input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://… (drive link, S3, etc.)"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Estimated Minutes</label>
            <input type="number" min="1" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="e.g. 15"
              className="w-32 px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
          </div>

          {/* Tags collapsible */}
          <button type="button" onClick={() => setShowTags(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold transition-colors"
            style={{ color: 'var(--text-faint)' }}>
            <Tag size={13} />
            {showTags ? 'Hide Tags' : 'Add Tags (Competency, Industry, Level, Program Type)'}
            {showTags ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showTags && (
            <div className="space-y-3 pl-1">
              {[
                { label: 'Competency Tags', val: tagsComp, set: setTagsComp, ph: 'e.g. Leadership, Communication…' },
                { label: 'Industry Tags',   val: tagsInd,  set: setTagsInd,  ph: 'e.g. BFSI, IT, Healthcare…' },
                { label: 'Level Tags',      val: tagsLvl,  set: setTagsLvl,  ph: 'e.g. Mid, Senior, CXO…' },
                { label: 'Program Type',    val: tagsProg, set: setTagsProg,  ph: 'e.g. Leadership, Sales…' },
              ].map(({ label, val, set, ph }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>{label}</label>
                  <TagInput value={val} onChange={set} placeholder={ph} />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(224,80,101,0.1)', color: '#e05065', border: '1px solid rgba(224,80,101,0.2)' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 text-sm py-2.5">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={save.isPending}
            className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2">
            {save.isPending ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Check size={14} />}
            {save.isPending ? 'Saving…' : isEdit ? 'Update' : 'Add Content'}
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

// ── Delete Modal ───────────────────────────────────────────────────────────────
function DeleteModal({ item, onClose }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api.delete(`/content/${item.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['content-library'] }); onClose(); },
  });
  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }} transition={{ duration: 0.22 }}
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'rgba(18,10,30,0.97)', border: '1px solid rgba(224,80,101,0.25)' }}>
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'rgba(224,80,101,0.12)' }}>
            <Trash2 size={20} style={{ color: '#e05065' }} />
          </div>
          <h2 className="font-bold text-[var(--text-heading)]">Delete Content?</h2>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>"{item.title}" will be removed from the library.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2.5">Cancel</button>
          <button onClick={() => del.mutate()} disabled={del.isPending}
            className="flex-1 text-sm py-2.5 rounded-xl font-semibold transition-all"
            style={{ background: 'rgba(224,80,101,0.15)', color: '#e05065', border: '1px solid rgba(224,80,101,0.3)' }}>
            {del.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

// ── Assign to Cohort Modal ─────────────────────────────────────────────────────
function AssignToCohortModal({ item, onClose }) {
  const qc = useQueryClient();
  const [cohortId, setCohortId] = useState('');
  const [moduleName, setModuleName] = useState('General');
  const [mandatory, setMandatory] = useState(false);
  const [visStatus, setVisStatus] = useState('published');
  const [releaseAt, setReleaseAt] = useState('');
  const [accessUntil, setAccessUntil] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: cohortsData } = useQuery({
    queryKey: ['cohorts-active'],
    queryFn: () => api.get('/cohorts', { params: { status: 'active', limit: 100 } }).then(r => r.data),
    staleTime: 30_000,
  });
  const activeCohorts = cohortsData?.data || [];

  const assign = useMutation({
    mutationFn: () => api.post(`/cohorts/${cohortId}/content`, {
      content_item_id: item.id,
      module_name: moduleName || 'General',
      mandatory,
      visibility_status: visStatus,
      release_at: releaseAt || undefined,
      access_until: accessUntil || undefined,
    }),
    onSuccess: () => {
      setSuccess('Assigned successfully!');
      qc.invalidateQueries({ queryKey: ['cohort-content'] });
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
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }} transition={{ duration: 0.22 }}
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: 'rgba(18,10,30,0.97)', border: '1px solid rgba(170,120,166,0.25)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--text-heading)] text-lg">Assign to Cohort</h2>
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-faint)' }}>{item.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#6a5880' }}
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

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Module Name</label>
            <input value={moduleName} onChange={e => setModuleName(e.target.value)} placeholder="e.g. Pre-Work, Module 1…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Release At</label>
              <input type="datetime-local" value={releaseAt} onChange={e => setReleaseAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#c8a0c4' }}>Access Until</label>
              <input type="datetime-local" value={accessUntil} onChange={e => setAccessUntil(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-2">
              {[
                { label: 'Mandatory for participants', val: mandatory, set: setMandatory },
              ].map(({ label, val, set }) => (
                <button key={label} type="button" onClick={() => set(v => !v)}
                  className="flex items-center gap-2.5 text-xs transition-colors"
                  style={{ color: val ? '#c8a0c4' : '#5a4870' }}>
                  <div className="w-4 h-4 rounded flex items-center justify-center"
                    style={{ background: val ? 'rgba(170,120,166,0.25)' : 'rgba(255,255,255,0.04)', border: `1px solid ${val ? 'rgba(170,120,166,0.5)' : 'rgba(170,120,166,0.15)'}` }}>
                    {val && <Check size={10} style={{ color: '#c8a0c4' }} />}
                  </div>
                  {label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#c8a0c4' }}>Visibility</label>
              <select value={visStatus} onChange={e => setVisStatus(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: 'var(--text-heading)' }}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
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

// ── Content Card ───────────────────────────────────────────────────────────────
function ContentCard({ item, onEdit, onDelete, onToggle, onAssign }) {
  const t = TYPE_MAP[item.content_type] || CONTENT_TYPES[0];
  const Icon = t.icon;
  const isPublished = item.library_status === 'published';
  const allTags = [
    ...(item.tags_competency || []),
    ...(item.tags_industry || []),
    ...(item.tags_level || []),
    ...(item.tags_program_type || []),
  ];

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
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

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.slice(0, 4).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(170,120,166,0.08)', color: 'var(--text-faint)', border: '1px solid rgba(170,120,166,0.12)' }}>
              {tag}
            </span>
          ))}
          {allTags.length > 4 && <span className="text-xs" style={{ color: 'var(--text-ghost)' }}>+{allTags.length - 4}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1" style={{ borderTop: '1px solid rgba(170,120,166,0.07)' }}>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: t.bg, color: t.color, border: `1px solid ${t.color}33` }}>{t.label}</span>
        {item.estimated_minutes && (
          <span className="flex items-center gap-1 text-xs" style={{ color: '#6a5880' }}>
            <Clock size={11} /> {item.estimated_minutes}m
          </span>
        )}
        <div className="flex-1" />
        <button onClick={() => onToggle(item)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
          style={{ background: isPublished ? 'rgba(64,201,128,0.08)' : 'rgba(200,150,80,0.08)', color: isPublished ? '#40c980' : '#c89650', border: `1px solid ${isPublished ? 'rgba(64,201,128,0.2)' : 'rgba(200,150,80,0.2)'}` }}>
          {isPublished ? <Eye size={11} /> : <EyeOff size={11} />}
          {isPublished ? 'Published' : 'Draft'}
        </button>
        <button onClick={() => onAssign(item)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'rgba(100,150,220,0.08)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.18)' }}>
          <Share2 size={11} /> Assign
        </button>
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

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContentPage() {
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal]           = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['content-library', search, typeFilter, statusFilter],
    queryFn: () => api.get('/content', {
      params: { content_type: typeFilter || undefined, library_status: statusFilter || undefined, limit: 100 },
    }).then(r => r.data),
    staleTime: 15_000,
  });

  const items = (data?.data || []).filter(i =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase())
  );
  const total     = data?.meta?.total ?? 0;
  const published = (data?.data || []).filter(i => i.library_status === 'published').length;
  const draft     = (data?.data || []).filter(i => i.library_status === 'draft').length;

  const toggleStatus = useMutation({
    mutationFn: (item) => api.patch(`/content/${item.id}`, { library_status: item.library_status === 'published' ? 'draft' : 'published' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-library'] }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 page-enter">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: 'var(--text-heading)' }}>Content Library</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {total} item{total !== 1 ? 's' : ''} · Re-usable, assignable to cohorts
          </p>
        </div>
        <button onClick={() => setModal({ type: 'create' })} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Content
        </button>
      </motion.div>

      {total > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',     value: total,     color: '#c8a0c4' },
            { label: 'Published', value: published, color: '#40c980' },
            { label: 'Draft',     value: draft,     color: '#c89650' },
            { label: 'Types',     value: new Set((data?.data || []).map(i => i.content_type)).size, color: '#6496dc' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search content…"
            className="bg-transparent outline-none text-sm flex-1" style={{ color: 'var(--text-heading)' }} />
          {search && <button onClick={() => setSearch('')}><X size={12} style={{ color: 'var(--text-faint)' }} /></button>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTypeFilter('')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ background: !typeFilter ? 'rgba(170,120,166,0.2)' : 'rgba(255,255,255,0.03)', color: !typeFilter ? '#c8a0c4' : '#6a5880', border: '1px solid rgba(170,120,166,0.14)' }}>
            All Types
          </button>
          {CONTENT_TYPES.map(t => {
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
          {['', 'published', 'draft'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: statusFilter === s ? (s === 'published' ? 'rgba(64,201,128,0.12)' : s === 'draft' ? 'rgba(200,150,80,0.12)' : 'rgba(170,120,166,0.15)') : 'transparent', color: statusFilter === s ? (s === 'published' ? '#40c980' : s === 'draft' ? '#c89650' : '#c8a0c4') : '#6a5880', border: '1px solid rgba(170,120,166,0.1)' }}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Status'}
            </button>
          ))}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="glass-card p-5 h-40 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-16 text-center">
          <BookOpen size={42} className="mx-auto mb-3 opacity-20" style={{ color: '#aa78a6' }} />
          <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>No content found</p>
          <p className="text-sm mt-1" style={{ color: '#6a5880' }}>
            {search || typeFilter || statusFilter ? 'Try adjusting filters' : 'Add your first re-usable content item'}
          </p>
          {!search && !typeFilter && !statusFilter && (
            <button onClick={() => setModal({ type: 'create' })} className="btn-primary mt-5 flex items-center gap-2 mx-auto text-sm">
              <Plus size={15} /> Add Content
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {items.map(item => (
              <ContentCard key={item.id} item={item}
                onEdit={i => setModal({ type: 'edit', item: i })}
                onDelete={i => setModal({ type: 'delete', item: i })}
                onToggle={i => toggleStatus.mutate(i)}
                onAssign={i => setModal({ type: 'assign', item: i })} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {modal?.type === 'create' && <ContentModal onClose={() => setModal(null)} />}
        {modal?.type === 'edit'   && <ContentModal item={modal.item} onClose={() => setModal(null)} />}
        {modal?.type === 'delete' && <DeleteModal item={modal.item} onClose={() => setModal(null)} />}
        {modal?.type === 'assign' && <AssignToCohortModal item={modal.item} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}
