import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Video, FileText, Layers, Users,
  CheckCircle, MapPin, Clock, Calendar, ExternalLink,
  Download, Lock, ChevronDown, ChevronUp, Check, X,
  Brain, Target, Star, Sliders, BarChart2, AlertCircle,
  PlayCircle, RefreshCw, Send, ChevronLeft, ChevronRight,
  Headphones, Package, Globe,
} from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import api from '../../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const INTERVENTION_ICONS = {
  pre_work: BookOpen, virtual_session: Video, case_study: FileText,
  study_material: BookOpen, reflection: Layers, group_activity: Users,
  assessment_window: CheckCircle, custom: MapPin,
};
const INTERVENTION_STYLES = {
  pre_work:          { bg: 'rgba(208,160,48,0.1)',  color: '#d0a030', border: 'rgba(208,160,48,0.2)',  label: 'Pre-Work' },
  virtual_session:   { bg: 'rgba(100,200,120,0.1)', color: '#64c878', border: 'rgba(100,200,120,0.2)', label: 'Virtual Session' },
  case_study:        { bg: 'rgba(200,100,100,0.1)', color: '#c86464', border: 'rgba(200,100,100,0.2)', label: 'Case Study' },
  study_material:    { bg: 'rgba(90,140,220,0.1)',  color: '#6496dc', border: 'rgba(90,140,220,0.2)',  label: 'Study Material' },
  reflection:        { bg: 'rgba(170,120,166,0.1)', color: '#aa78a6', border: 'rgba(170,120,166,0.2)', label: 'Reflection' },
  group_activity:    { bg: 'rgba(100,200,180,0.1)', color: '#64c8b4', border: 'rgba(100,200,180,0.2)', label: 'Group Activity' },
  assessment_window: { bg: 'rgba(200,150,80,0.1)',  color: '#c89650', border: 'rgba(200,150,80,0.2)',  label: 'Assessment' },
  custom:            { bg: 'rgba(170,120,166,0.06)', color: '#9080a8', border: 'rgba(170,120,166,0.15)', label: 'Activity' },
};
const SECTIONS = [
  { key: 'all',              label: 'Full Journey',     filter: null },
  { key: 'pre_work',         label: 'Pre-Work',         filter: ['pre_work'] },
  { key: 'virtual_session',  label: 'Virtual Sessions', filter: ['virtual_session'] },
  { key: 'study_material',   label: 'Study Material',   filter: ['study_material','case_study'] },
  { key: 'assessment_window',label: 'Assessments',      filter: ['assessment_window'] },
];
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

// ─────────────────────────────────────────────────────────────────────────────
// Journey: InterventionCard
// ─────────────────────────────────────────────────────────────────────────────
function InterventionCard({ iv, index }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = INTERVENTION_ICONS[iv.intervention_type] || MapPin;
  const style = INTERVENTION_STYLES[iv.intervention_type] || INTERVENTION_STYLES.custom;
  const isLocked = iv.release_at && isAfter(new Date(iv.release_at), new Date());
  const isExpired = iv.access_until && isAfter(new Date(), new Date(iv.access_until));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
      className={`glass-card overflow-hidden transition-all duration-200 ${isLocked ? 'opacity-50' : ''}`}
      style={{ border: expanded ? `1px solid ${style.border}` : undefined }}>
      <div className="p-4 flex items-start gap-4 cursor-pointer" onClick={() => !isLocked && setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: style.bg, border: `1px solid ${style.border}` }}>
          {isLocked ? <Lock size={16} style={{ color: style.color }} /> : <Icon size={17} style={{ color: style.color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-medium text-sm" style={{ color: isLocked ? '#7060a0' : '#f0e8fc' }}>{iv.title}</h3>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-xs" style={{ color: style.color }}>{style.label}</span>
                {iv.is_mandatory && (
                  <span className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(200,150,80,0.1)', color: '#c89650', border: '1px solid rgba(200,150,80,0.2)' }}>Required</span>
                )}
                {isLocked && iv.release_at && (
                  <span className="text-xs" style={{ color: '#5a4870' }}>Unlocks {format(new Date(iv.release_at), 'MMM d')}</span>
                )}
                {isExpired && <span className="text-xs" style={{ color: '#e05065' }}>Expired</span>}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {iv.scheduled_date && (
                <div className="hidden sm:flex items-center gap-1 text-xs" style={{ color: '#7060a0' }}>
                  <Calendar size={11} />{format(parseISO(iv.scheduled_date), 'MMM d')}{iv.scheduled_time ? `, ${iv.scheduled_time.slice(0,5)}` : ''}
                </div>
              )}
              {iv.duration_minutes && (
                <div className="hidden sm:flex items-center gap-1 text-xs" style={{ color: '#7060a0' }}><Clock size={11} />{iv.duration_minutes}m</div>
              )}
              {!isLocked && <span style={{ color: '#7060a0' }}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }} className="px-4 pb-4 space-y-3">
          {iv.description && <p className="text-sm" style={{ color: '#9080a8' }}>{iv.description}</p>}
          {iv.intervention_type === 'virtual_session' && iv.virtual_session_link && (
            <a href={iv.virtual_session_link} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(100,200,120,0.15)', color: '#64c878', border: '1px solid rgba(100,200,120,0.3)' }}>
              <Video size={15} /> Join Session {iv.virtual_session_platform && `on ${iv.virtual_session_platform}`} <ExternalLink size={13} />
            </a>
          )}
          {iv.content_items && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(100,150,220,0.07)', border: '1px solid rgba(100,150,220,0.15)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <BookOpen size={16} style={{ color: '#6496dc' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#f0e8fc' }}>{iv.content_items.title}</p>
                    <p className="text-xs capitalize mt-0.5" style={{ color: '#7060a0' }}>
                      {iv.content_items.content_type?.replace(/_/g,' ')}
                      {iv.content_items.estimated_minutes ? ` · ${iv.content_items.estimated_minutes} min` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {iv.content_items.external_url && (
                    <a href={iv.content_items.external_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'rgba(100,150,220,0.15)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.25)' }}>
                      <ExternalLink size={12} /> Open
                    </a>
                  )}
                  {iv.content_items.file_url && (
                    <a href={iv.content_items.file_url} target="_blank" rel="noreferrer" download
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'rgba(170,120,166,0.1)', color: '#aa78a6', border: '1px solid rgba(170,120,166,0.2)' }}>
                      <Download size={12} /> Download
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Tab: level-based sequential content with Mark as Read
// ─────────────────────────────────────────────────────────────────────────────
function ContentTab({ cohortId }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['participant-content', cohortId],
    queryFn: () => api.get(`/participant/cohorts/${cohortId}/content`).then(r => r.data.data),
    staleTime: 10_000,
  });

  const markRead = useMutation({
    mutationFn: (caId) => api.post(`/participant/content-progress/${caId}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participant-content', cohortId] }),
  });

  const items = data || [];

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
    </div>
  );

  if (!items.length) return (
    <div className="glass-card p-14 text-center">
      <BookOpen size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#aa78a6' }} />
      <p style={{ color: '#7060a0' }}>No content has been assigned to this cohort yet.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const c = item.content_items;
        if (!c) return null;
        const t = CONTENT_TYPE_MAP[c.content_type] || CONTENT_TYPE_MAP.article;
        const Icon = t.icon;
        const isLocked = item.is_locked;
        const isDone = item.is_completed;

        return (
          <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`glass-card p-5 transition-all ${isLocked ? 'opacity-40' : ''}`}
            style={{ border: `1px solid ${isDone ? 'rgba(64,201,128,0.2)' : isLocked ? 'rgba(170,120,166,0.06)' : 'rgba(170,120,166,0.12)'}` }}>
            <div className="flex items-start gap-4">
              {/* Level indicator */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: isDone ? 'rgba(64,201,128,0.15)' : isLocked ? 'rgba(90,72,112,0.2)' : t.bg, border: `1px solid ${isDone ? 'rgba(64,201,128,0.3)' : isLocked ? 'rgba(90,72,112,0.2)' : t.color + '33'}` }}>
                  {isDone ? <Check size={16} style={{ color: '#40c980' }} /> : isLocked ? <Lock size={15} style={{ color: '#5a4870' }} /> : <Icon size={16} style={{ color: t.color }} />}
                </div>
                <span className="text-xs font-bold" style={{ color: '#5a4870' }}>L{i + 1}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm" style={{ color: isLocked ? '#5a4870' : '#f0e8fc' }}>{c.title}</h3>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs" style={{ color: isLocked ? '#5a4870' : t.color }}>{t.label}</span>
                      {c.estimated_minutes && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: '#6a5880' }}>
                          <Clock size={10} /> {c.estimated_minutes} min
                        </span>
                      )}
                      {item.module_name && item.module_name !== 'General' && (
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{ background: 'rgba(170,120,166,0.08)', color: '#7060a0', border: '1px solid rgba(170,120,166,0.12)' }}>
                          {item.module_name}
                        </span>
                      )}
                    </div>
                    {c.description && !isLocked && (
                      <p className="text-xs mt-1.5 line-clamp-2" style={{ color: '#7060a0' }}>{c.description}</p>
                    )}
                    {isLocked && i > 0 && (
                      <p className="text-xs mt-1" style={{ color: '#5a4870' }}>Complete Level {i} to unlock</p>
                    )}
                  </div>

                  {!isLocked && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Open/Download links */}
                      {c.external_url && (
                        <a href={c.external_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}33` }}>
                          <ExternalLink size={12} /> Open
                        </a>
                      )}
                      {c.file_url && (
                        <a href={c.file_url} target="_blank" rel="noreferrer" download
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: 'rgba(170,120,166,0.1)', color: '#aa78a6', border: '1px solid rgba(170,120,166,0.2)' }}>
                          <Download size={12} /> Download
                        </a>
                      )}

                      {/* Mark as Read */}
                      {isDone ? (
                        <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold"
                          style={{ background: 'rgba(64,201,128,0.1)', color: '#40c980', border: '1px solid rgba(64,201,128,0.2)' }}>
                          <CheckCircle size={12} /> Read
                        </span>
                      ) : (
                        <button onClick={() => markRead.mutate(item.id)}
                          disabled={markRead.isPending}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                          style={{ background: 'rgba(170,120,166,0.12)', color: '#c8a0c4', border: '1px solid rgba(170,120,166,0.25)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.22)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.12)'; }}>
                          {markRead.isPending ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" /> : <Check size={12} />}
                          Mark as Read
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline body for articles/reflections */}
                {!isLocked && c.rich_body && (
                  <div className="mt-4 pt-4 text-sm leading-relaxed"
                    style={{ borderTop: '1px solid rgba(170,120,166,0.1)', color: '#c0b8d8' }}>
                    {c.rich_body}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment Taking View
// ─────────────────────────────────────────────────────────────────────────────
function AssessmentTaker({ assignment, responseId: initialRespId, onDone }) {
  const qc = useQueryClient();
  const [respId, setRespId] = useState(initialRespId);
  const [answers, setAnswers] = useState({});
  const [currentSection, setCurrentSection] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const saveTimer = useRef(null);

  const assessment = assignment.assessments;
  const sections = assessment?.sections || [];
  const totalSections = sections.length;

  // Auto-save answers every 10s
  const autoSave = useCallback(() => {
    if (!respId || submitted) return;
    api.patch(`/participant/responses/${respId}`, { answers }).catch(() => {});
  }, [respId, answers, submitted]);

  useEffect(() => {
    saveTimer.current = setInterval(autoSave, 10000);
    return () => clearInterval(saveTimer.current);
  }, [autoSave]);

  const setAnswer = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const submit = useMutation({
    mutationFn: () => api.post(`/participant/responses/${respId}/submit`, { answers }),
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ['participant-assessments'] });
    },
    onError: err => setError(err.response?.data?.error?.message || 'Submit failed'),
  });

  if (submitted) return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-12 text-center space-y-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
        style={{ background: 'rgba(64,201,128,0.15)', border: '2px solid rgba(64,201,128,0.3)' }}>
        <CheckCircle size={28} style={{ color: '#40c980' }} />
      </div>
      <h2 className="text-xl font-bold" style={{ color: '#f0e8fc' }}>Assessment Submitted!</h2>
      <p style={{ color: '#7060a0' }}>Your responses have been recorded. Results will be shared by your facilitator.</p>
      <button onClick={onDone} className="btn-primary mt-2 flex items-center gap-2 mx-auto">
        <ArrowLeft size={15} /> Back to Assessments
      </button>
    </motion.div>
  );

  const section = sections[currentSection];
  if (!section) return null;
  const questions = section.questions || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3">
          <button onClick={onDone} className="p-1.5 rounded-lg" style={{ color: '#7060a0' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c8a0c4'}
            onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}><ArrowLeft size={18} /></button>
          <div className="flex-1">
            <h2 className="font-bold" style={{ color: '#f0e8fc' }}>{assessment.title}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#7060a0' }}>
              Section {currentSection + 1} of {totalSections}
            </p>
          </div>
          {assessment.timer_minutes && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(200,150,80,0.1)', color: '#c89650', border: '1px solid rgba(200,150,80,0.2)' }}>
              <Clock size={12} /> {assessment.timer_minutes}m
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex gap-1">
            {sections.map((_, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                style={{ background: i < currentSection ? '#aa78a6' : i === currentSection ? 'rgba(170,120,166,0.5)' : 'rgba(170,120,166,0.12)' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Section */}
      <motion.div key={currentSection} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        className="glass-card p-6 space-y-6">
        <div>
          <h3 className="font-semibold text-base" style={{ color: '#f0e8fc' }}>{section.title}</h3>
          {section.instructions && (
            <p className="text-sm mt-1" style={{ color: '#7060a0' }}>{section.instructions}</p>
          )}
        </div>

        {questions.map((q, qi) => (
          <div key={q.id || qi} className="space-y-3">
            <p className="text-sm font-medium" style={{ color: '#e0d8f0' }}>
              <span className="mr-2 text-xs font-bold" style={{ color: '#7060a0' }}>{qi + 1}.</span>
              {q.text}
            </p>

            {/* MCQ */}
            {q.type === 'mcq' && (
              <div className="space-y-2">
                {(q.options || []).map((opt, oi) => (
                  <button key={oi} type="button" onClick={() => setAnswer(q.id || qi, oi)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
                    style={{
                      background: answers[q.id || qi] === oi ? 'rgba(170,120,166,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${answers[q.id || qi] === oi ? 'rgba(170,120,166,0.4)' : 'rgba(170,120,166,0.1)'}`,
                      color: answers[q.id || qi] === oi ? '#f0e8fc' : '#9080a8',
                    }}>
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: answers[q.id || qi] === oi ? 'rgba(170,120,166,0.3)' : 'rgba(170,120,166,0.1)', color: '#aa78a6' }}>
                      {String.fromCharCode(65 + oi)}
                    </div>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Open Ended */}
            {q.type === 'open_ended' && (
              <textarea
                value={answers[q.id || qi] || ''}
                onChange={e => setAnswer(q.id || qi, e.target.value)}
                placeholder="Type your response…"
                rows={4}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.2)', color: '#f0e8fc' }}
              />
            )}

            {/* Rating Scale */}
            {q.type === 'rating_scale' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {Array.from({ length: (q.max_value || 5) - (q.min_value || 1) + 1 }, (_, i) => i + (q.min_value || 1)).map(v => (
                    <button key={v} type="button" onClick={() => setAnswer(q.id || qi, v)}
                      className="w-10 h-10 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: answers[q.id || qi] === v ? 'rgba(170,120,166,0.25)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${answers[q.id || qi] === v ? 'rgba(170,120,166,0.5)' : 'rgba(170,120,166,0.12)'}`,
                        color: answers[q.id || qi] === v ? '#f0e8fc' : '#7060a0',
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
                {(q.min_label || q.max_label) && (
                  <div className="flex justify-between text-xs" style={{ color: '#5a4870' }}>
                    <span>{q.min_label || 'Low'}</span>
                    <span>{q.max_label || 'High'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Likert */}
            {q.type === 'likert' && (
              <div className="flex gap-2 flex-wrap">
                {[1,2,3,4,5].map(v => {
                  const labels = ['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree'];
                  return (
                    <button key={v} type="button" onClick={() => setAnswer(q.id || qi, v)}
                      className="flex-1 min-w-[90px] flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs transition-all"
                      style={{
                        background: answers[q.id || qi] === v ? 'rgba(170,120,166,0.2)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${answers[q.id || qi] === v ? 'rgba(170,120,166,0.45)' : 'rgba(170,120,166,0.1)'}`,
                        color: answers[q.id || qi] === v ? '#f0e8fc' : '#6a5880',
                      }}>
                      <span className="font-bold text-base">{v}</span>
                      <span className="text-center leading-tight">{labels[v-1]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(224,80,101,0.1)', color: '#e05065', border: '1px solid rgba(224,80,101,0.2)' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentSection(s => Math.max(0, s - 1))}
          disabled={currentSection === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all btn-ghost disabled:opacity-40">
          <ChevronLeft size={16} /> Previous
        </button>

        {currentSection < totalSections - 1 ? (
          <button onClick={() => setCurrentSection(s => s + 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium btn-primary">
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={() => submit.mutate()} disabled={submit.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(64,201,128,0.15)', color: '#40c980', border: '1px solid rgba(64,201,128,0.3)' }}>
            {submit.isPending ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Send size={15} />}
            {submit.isPending ? 'Submitting…' : 'Submit Assessment'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessments Tab
// ─────────────────────────────────────────────────────────────────────────────
function AssessmentsTab({ cohortId }) {
  const [taking, setTaking] = useState(null); // { assignment, responseId }

  const { data, isLoading } = useQuery({
    queryKey: ['participant-assessments', cohortId],
    queryFn: () => api.get(`/participant/cohorts/${cohortId}/assessments`).then(r => r.data.data),
    staleTime: 10_000,
  });

  const start = useMutation({
    mutationFn: (asgId) => api.post(`/participant/assessments/${asgId}/start`).then(r => r.data),
    onSuccess: (data, asgId) => {
      const assignment = (items || []).find(a => a.id === asgId);
      setTaking({ assignment, responseId: data.data?.id });
    },
  });

  const items = data || [];

  if (taking) {
    return (
      <AssessmentTaker
        assignment={taking.assignment}
        responseId={taking.responseId}
        onDone={() => setTaking(null)}
      />
    );
  }

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
    </div>
  );

  if (!items.length) return (
    <div className="glass-card p-14 text-center">
      <Brain size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#aa78a6' }} />
      <p style={{ color: '#7060a0' }}>No assessments have been assigned to this cohort yet.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map((asg, i) => {
        const a = asg.assessments;
        if (!a) return null;
        const t = ASSESSMENT_TYPE_MAP[a.assessment_type] || ASSESSMENT_TYPE_MAP.knowledge_check;
        const Icon = t.icon;
        const resp = asg.my_response;
        const totalQs = (a.sections || []).reduce((s, sec) => s + (sec.questions?.length || 0), 0);
        const isOpen = !asg.access_close || isAfter(new Date(asg.access_close), new Date());
        const hasOpened = !asg.access_open || isAfter(new Date(), new Date(asg.access_open));

        let statusBadge = null;
        let actionBtn = null;

        if (resp?.status === 'submitted' || resp?.status === 'scored') {
          statusBadge = (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: 'rgba(64,201,128,0.1)', color: '#40c980', border: '1px solid rgba(64,201,128,0.2)' }}>
              <CheckCircle size={12} />
              {resp.status === 'scored' ? `Scored: ${resp.total_score ?? '—'}` : 'Submitted'}
            </span>
          );
        } else if (resp?.status === 'in_progress') {
          actionBtn = (
            <button onClick={() => setTaking({ assignment: asg, responseId: resp.id })}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
              style={{ background: 'rgba(200,150,80,0.12)', color: '#c89650', border: '1px solid rgba(200,150,80,0.25)' }}>
              <RefreshCw size={12} /> Continue
            </button>
          );
        } else if (hasOpened && isOpen) {
          actionBtn = (
            <button onClick={() => start.mutate(asg.id)}
              disabled={start.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all btn-primary"
              style={{ fontSize: '12px' }}>
              {start.isPending ? <div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" /> : <PlayCircle size={12} />}
              Start
            </button>
          );
        }

        return (
          <motion.div key={asg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
            style={{ border: '1px solid rgba(170,120,166,0.1)' }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: t.bg, border: `1px solid ${t.color}33` }}>
                <Icon size={17} style={{ color: t.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm" style={{ color: '#f0e8fc' }}>{a.title}</h3>
                    {a.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#7060a0' }}>{a.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs" style={{ color: '#6a5880' }}>
                      <span style={{ color: t.color }}>{t.label}</span>
                      <span>{(a.sections || []).length} sections · {totalQs} questions</span>
                      {a.timer_minutes && <span className="flex items-center gap-1"><Clock size={10} /> {a.timer_minutes}m</span>}
                      {asg.mandatory && (
                        <span className="px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(200,150,80,0.1)', color: '#c89650', border: '1px solid rgba(200,150,80,0.2)' }}>
                          Required
                        </span>
                      )}
                    </div>
                    {asg.access_open && !hasOpened && (
                      <p className="text-xs mt-1.5" style={{ color: '#5a4870' }}>
                        Opens {format(new Date(asg.access_open), 'MMM d, yyyy HH:mm')}
                      </p>
                    )}
                    {asg.access_close && (
                      <p className="text-xs mt-1" style={{ color: isOpen ? '#7060a0' : '#e05065' }}>
                        {isOpen ? `Closes ${format(new Date(asg.access_close), 'MMM d, yyyy HH:mm')}` : 'Access closed'}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {statusBadge || actionBtn}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ParticipantCohortPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('all');
  const [mainTab, setMainTab] = useState('Journey');

  const { data: cohort, isLoading: loadingCohort } = useQuery({
    queryKey: ['cohort', id],
    queryFn: () => api.get(`/cohorts/${id}`).then(r => r.data.data),
  });

  const { data: journey, isLoading: loadingJourney } = useQuery({
    queryKey: ['journey', id],
    queryFn: () => api.get(`/cohorts/${id}/journey`).then(r => r.data.data),
    enabled: mainTab === 'Journey',
  });

  const interventions = journey?.interventions || [];
  const sectionCounts = SECTIONS.reduce((acc, s) => {
    acc[s.key] = s.filter ? interventions.filter(iv => s.filter.includes(iv.intervention_type)).length : interventions.length;
    return acc;
  }, {});
  const visibleSections = SECTIONS.filter(s => !s.filter || sectionCounts[s.key] > 0);
  const filteredInterventions = SECTIONS.find(s => s.key === activeSection)?.filter
    ? interventions.filter(iv => SECTIONS.find(s => s.key === activeSection)?.filter?.includes(iv.intervention_type))
    : interventions;

  if (loadingCohort) return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-64 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 page-enter">
      <button onClick={() => navigate('/participant')}
        className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: '#7060a0' }}
        onMouseEnter={e => e.currentTarget.style.color = '#e8e0f0'}
        onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}>
        <ArrowLeft size={16} /> My Learning
      </button>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
        <div className="h-2" style={{ background: 'linear-gradient(90deg, #aa78a6, #6496dc)' }} />
        <div className="p-6">
          <p className="text-xs font-mono mb-1" style={{ color: '#7060a0' }}>{cohort?.cohort_code}</p>
          <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>{cohort?.name}</h1>
          <p className="mt-1 text-sm" style={{ color: '#9080a8' }}>{cohort?.organizations?.display_name}</p>
          <div className="flex flex-wrap gap-4 mt-4 text-sm" style={{ color: '#7060a0' }}>
            {cohort?.start_date && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                {format(parseISO(cohort.start_date), 'MMM d')} – {cohort.end_date ? format(parseISO(cohort.end_date), 'MMM d, yyyy') : 'Ongoing'}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Layers size={13} />{interventions.length} activities
            </span>
          </div>
        </div>
      </motion.div>

      {/* Main Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(170,120,166,0.1)' }}>
        {['Journey', 'Content', 'Assessments'].map(t => (
          <button key={t} onClick={() => setMainTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: mainTab === t ? 'rgba(170,120,166,0.18)' : 'transparent',
              color: mainTab === t ? '#f0e8fc' : '#7060a0',
              border: mainTab === t ? '1px solid rgba(170,120,166,0.3)' : '1px solid transparent',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Journey Tab */}
      {mainTab === 'Journey' && (
        <>
          {visibleSections.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {visibleSections.map(s => (
                <button key={s.key} onClick={() => setActiveSection(s.key)}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: activeSection === s.key ? 'rgba(170,120,166,0.18)' : 'rgba(255,255,255,0.04)',
                    color: activeSection === s.key ? '#f0e8fc' : '#7060a0',
                    border: activeSection === s.key ? '1px solid rgba(170,120,166,0.3)' : '1px solid rgba(170,120,166,0.08)',
                  }}>
                  {s.label}
                  {sectionCounts[s.key] > 0 && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: activeSection === s.key ? 'rgba(170,120,166,0.3)' : 'rgba(170,120,166,0.1)', color: '#aa78a6' }}>
                      {sectionCounts[s.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {loadingJourney ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : filteredInterventions.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <BookOpen size={40} className="mx-auto mb-3" style={{ color: '#3e2860' }} />
              <p style={{ color: '#7060a0' }}>
                {activeSection === 'all' ? 'Your learning journey will appear here once your facilitator sets it up.' : 'No activities in this section yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInterventions.map((iv, i) => <InterventionCard key={iv.id} iv={iv} index={i} />)}
            </div>
          )}
        </>
      )}

      {/* Content Tab */}
      {mainTab === 'Content' && <ContentTab cohortId={id} />}

      {/* Assessments Tab */}
      {mainTab === 'Assessments' && <AssessmentsTab cohortId={id} />}
    </div>
  );
}
