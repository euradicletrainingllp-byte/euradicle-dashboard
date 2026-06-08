import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Video, FileText, Layers, Users,
  CheckCircle, MapPin, Clock, Calendar, ExternalLink,
  Download, Lock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format, isAfter } from 'date-fns';
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

// Group interventions by type category for the tab sections
const SECTIONS = [
  { key: 'all',              label: 'Full Journey',       filter: null },
  { key: 'pre_work',         label: 'Pre-Work',           filter: ['pre_work'] },
  { key: 'virtual_session',  label: 'Virtual Sessions',   filter: ['virtual_session'] },
  { key: 'study_material',   label: 'Study Material',     filter: ['study_material', 'case_study'] },
  { key: 'assessment_window',label: 'Assessments',        filter: ['assessment_window'] },
];

function InterventionCard({ iv, index }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = INTERVENTION_ICONS[iv.intervention_type] || MapPin;
  const style = INTERVENTION_STYLES[iv.intervention_type] || INTERVENTION_STYLES.custom;
  const isLocked = iv.release_at && isAfter(new Date(iv.release_at), new Date());
  const isExpired = iv.access_until && isAfter(new Date(), new Date(iv.access_until));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`glass-card overflow-hidden transition-all duration-200 ${isLocked ? 'opacity-50' : ''}`}
      style={{ border: expanded ? `1px solid ${style.border}` : undefined }}>
      <div
        className="p-4 flex items-start gap-4 cursor-pointer"
        onClick={() => !isLocked && setExpanded(e => !e)}>
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
                  <span className="text-xs px-1.5 py-0.5 rounded text-xs"
                    style={{ background: 'rgba(200,150,80,0.1)', color: '#c89650', border: '1px solid rgba(200,150,80,0.2)' }}>
                    Required
                  </span>
                )}
                {isLocked && iv.release_at && (
                  <span className="text-xs" style={{ color: '#5a4870' }}>
                    Unlocks {format(new Date(iv.release_at), 'MMM d')}
                  </span>
                )}
                {isExpired && (
                  <span className="text-xs" style={{ color: '#e05065' }}>Expired</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {iv.scheduled_date && (
                <div className="hidden sm:flex items-center gap-1 text-xs" style={{ color: '#7060a0' }}>
                  <Calendar size={11} />
                  {format(new Date(iv.scheduled_date), 'MMM d')}
                  {iv.scheduled_time ? `, ${iv.scheduled_time.slice(0,5)}` : ''}
                </div>
              )}
              {iv.duration_minutes && (
                <div className="hidden sm:flex items-center gap-1 text-xs" style={{ color: '#7060a0' }}>
                  <Clock size={11} />{iv.duration_minutes}m
                </div>
              )}
              {!isLocked && (
                <span style={{ color: '#7060a0' }}>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {expanded && !isLocked && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-4 pt-0 border-t" style={{ borderColor: 'rgba(170,120,166,0.1)' }}>
          <div className="pt-4 space-y-4">
            {iv.description && (
              <p className="text-sm" style={{ color: '#c0b8d8' }}>{iv.description}</p>
            )}

            {/* Scheduled details */}
            {(iv.scheduled_date || iv.duration_minutes) && (
              <div className="flex flex-wrap gap-3">
                {iv.scheduled_date && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(170,120,166,0.06)', border: '1px solid rgba(170,120,166,0.12)' }}>
                    <Calendar size={13} style={{ color: '#aa78a6' }} />
                    <span style={{ color: '#c0b8d8' }}>
                      {format(new Date(iv.scheduled_date), 'EEEE, MMMM d, yyyy')}
                      {iv.scheduled_time ? ` at ${iv.scheduled_time.slice(0,5)}` : ''}
                    </span>
                  </div>
                )}
                {iv.duration_minutes && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(170,120,166,0.06)', border: '1px solid rgba(170,120,166,0.12)' }}>
                    <Clock size={13} style={{ color: '#aa78a6' }} />
                    <span style={{ color: '#c0b8d8' }}>{iv.duration_minutes} minutes</span>
                  </div>
                )}
              </div>
            )}

            {/* Virtual session join button */}
            {iv.intervention_type === 'virtual_session' && iv.virtual_session_link && (
              <a href={iv.virtual_session_link} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={{ background: 'rgba(100,200,120,0.15)', color: '#64c878', border: '1px solid rgba(100,200,120,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,200,120,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,200,120,0.15)'}>
                <Video size={15} />
                Join Session
                {iv.virtual_session_platform && ` on ${iv.virtual_session_platform}`}
                <ExternalLink size={13} />
              </a>
            )}

            {/* Content item */}
            {iv.content_items && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(100,150,220,0.07)', border: '1px solid rgba(100,150,220,0.15)' }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <BookOpen size={16} style={{ color: '#6496dc' }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#f0e8fc' }}>{iv.content_items.title}</p>
                      <p className="text-xs capitalize mt-0.5" style={{ color: '#7060a0' }}>
                        {iv.content_items.content_type?.replace(/_/g, ' ')}
                        {iv.content_items.estimated_minutes ? ` · ${iv.content_items.estimated_minutes} min read` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {iv.content_items.external_url && (
                      <a href={iv.content_items.external_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                        style={{ background: 'rgba(100,150,220,0.15)', color: '#6496dc', border: '1px solid rgba(100,150,220,0.25)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,150,220,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,150,220,0.15)'}>
                        <ExternalLink size={12} /> Open
                      </a>
                    )}
                    {iv.content_items.file_url && (
                      <a href={iv.content_items.file_url} target="_blank" rel="noreferrer" download
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                        style={{ background: 'rgba(170,120,166,0.1)', color: '#aa78a6', border: '1px solid rgba(170,120,166,0.2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(170,120,166,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(170,120,166,0.1)'}>
                        <Download size={12} /> Download
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function ParticipantCohortPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('all');

  const { data: cohort, isLoading: loadingCohort } = useQuery({
    queryKey: ['cohort', id],
    queryFn: () => api.get(`/cohorts/${id}`).then(r => r.data.data),
  });

  const { data: journey, isLoading: loadingJourney } = useQuery({
    queryKey: ['journey', id],
    queryFn: () => api.get(`/cohorts/${id}/journey`).then(r => r.data.data),
  });

  const interventions = journey?.interventions || [];

  const sectionCounts = SECTIONS.reduce((acc, s) => {
    acc[s.key] = s.filter
      ? interventions.filter(iv => s.filter.includes(iv.intervention_type)).length
      : interventions.length;
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
                {format(new Date(cohort.start_date), 'MMM d')} – {cohort.end_date ? format(new Date(cohort.end_date), 'MMM d, yyyy') : 'Ongoing'}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Layers size={13} />
              {interventions.length} activities
            </span>
          </div>
        </div>
      </motion.div>

      {/* Section tabs */}
      {visibleSections.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visibleSections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
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

      {/* Interventions */}
      {loadingJourney ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : filteredInterventions.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <BookOpen size={40} className="mx-auto mb-3" style={{ color: '#3e2860' }} />
          <p style={{ color: '#7060a0' }}>
            {activeSection === 'all'
              ? 'Your learning journey will appear here once your facilitator sets it up.'
              : 'No activities in this section yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInterventions.map((iv, i) => (
            <InterventionCard key={iv.id} iv={iv} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
