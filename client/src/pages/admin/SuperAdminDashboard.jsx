import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, GraduationCap, ClipboardCheck,
  AlertTriangle, RefreshCw, TrendingUp, Activity,
  Clock, ChevronRight, Zap
} from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import api from '../../lib/api';
import { formatDistanceToNow, format } from 'date-fns';

// ── Animated 3D orb for KPI cards ────────────────────────────────────────────
function Orb({ color = '#aa78a6', size = 0.6 }) {
  const mesh = useRef();
  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.rotation.x = clock.getElapsedTime() * 0.4;
      mesh.current.rotation.y = clock.getElapsedTime() * 0.6;
    }
  });
  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[size, 1]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
    </mesh>
  );
}

function KpiOrb({ color }) {
  return (
    <div className="w-14 h-14 flex-shrink-0">
      <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }} dpr={[1, 1.5]}>
        <Orb color={color} />
      </Canvas>
    </div>
  );
}

// ── Health label helpers ──────────────────────────────────────────────────────
const healthColors = {
  green: { dot: '#40c980', bg: 'rgba(64,201,128,0.1)',  border: 'rgba(64,201,128,0.28)', text: '#40c980' },
  amber: { dot: '#f0a832', bg: 'rgba(240,168,50,0.1)',  border: 'rgba(240,168,50,0.28)', text: '#f0a832' },
  red:   { dot: '#e05065', bg: 'rgba(224,80,101,0.1)',  border: 'rgba(224,80,101,0.28)', text: '#e05065' },
  grey:  { dot: '#5a5070', bg: 'rgba(90,80,112,0.1)',   border: 'rgba(90,80,112,0.2)',   text: '#9080a8' },
};

function HealthBadge({ label }) {
  const c = healthColors[label] || healthColors.grey;
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot, boxShadow: `0 0 4px ${c.dot}` }} />
      {label}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, color, orbColor, onClick, loading, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      onClick={onClick}
      className="glass-card-hover p-5 cursor-pointer relative overflow-hidden"
    >
      {/* Glow accent */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 blur-2xl pointer-events-none"
        style={{ background: orbColor, transform: 'translate(30%, -30%)' }} />

      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: `${orbColor}18`, border: `1px solid ${orbColor}30` }}>
          <Icon size={20} style={{ color: orbColor }} />
        </div>
        <KpiOrb color={orbColor} />
      </div>

      {loading ? (
        <div className="h-8 w-20 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
      ) : (
        <p className="text-3xl font-bold text-white mb-1">{value ?? '—'}</p>
      )}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </motion.div>
  );
}

// ── Cohort health card ────────────────────────────────────────────────────────
function CohortHealthCard({ cohort, index }) {
  const navigate = useNavigate();
  const isExpiring = cohort.end_date && new Date(cohort.end_date) <= new Date(Date.now() + 7 * 86400000);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      onClick={() => navigate(`/admin/cohorts/${cohort.id}`)}
      className="glass-card-hover p-4 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <HealthBadge label={cohort.health_label || 'grey'} />
          </div>
          <p className="font-semibold text-white text-sm truncate">{cohort.name}</p>
          <p className="text-xs text-slate-500 truncate">{cohort.organizations?.display_name}</p>
        </div>
        <ChevronRight size={16} className="text-slate-600 flex-shrink-0 mt-1" />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <Users size={12} />
          {cohort.enrollment_count ?? 0} participants
        </span>
        <span className={`flex items-center gap-1 ${isExpiring ? 'text-red-400' : ''}`}>
          <Clock size={12} />
          {cohort.end_date ? format(new Date(cohort.end_date), 'MMM d') : '—'}
          {isExpiring && ' ⚠'}
        </span>
      </div>

      {/* Health score bar */}
      {cohort.health_score != null && (
        <div className="mt-3">
          <div className="progress-bar">
            <div className="progress-bar-fill"
              style={{
                width: `${cohort.health_score}%`,
                background: cohort.health_label === 'green' ? '#40c980' : cohort.health_label === 'amber' ? '#f0a832' : cohort.health_label === 'red' ? '#e05065' : '#5a5070',
              }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Activity feed item ────────────────────────────────────────────────────────
const actionLabels = {
  'user.first_login':              { label: 'First login',       color: '#aa78a6' },
  'assessment_response.submitted': { label: 'Assessment done',   color: '#40c980' },
  'content_item.created':          { label: 'Content added',     color: '#c8a0c4' },
  'user.login':                    { label: 'Admin login',       color: '#7a5090' },
  'cohort.launched':               { label: 'Cohort launched',   color: '#f0a832' },
  'organization.created':          { label: 'Org created',       color: '#3e3264' },
  'cohort.created':                { label: 'Cohort created',    color: '#aa78a6' },
  'system.inactivity_alert':       { label: 'Inactivity alert',  color: '#e05065' },
};

function ActivityItem({ log, index }) {
  const meta = actionLabels[log.action_type] || { label: log.action_type, color: '#64748b' };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.04 }}
      className="flex items-start gap-3 py-3 last:border-0" style={{ borderBottom: '1px solid rgba(170,120,166,0.1)' }}>
      <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300">{log.action_type}</p>
        <p className="text-xs text-slate-500 mt-0.5">{log.entity_type} · {log.entity_id?.slice(0, 8)}…</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>
          {meta.label}
        </span>
        <p className="text-xs text-slate-600 mt-1">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
      </div>
    </motion.div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const navigate = useNavigate();

  const { data: dashData, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data.data),
    refetchInterval: 60_000,
  });

  const { data: healthBoard, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['cohort-health-board'],
    queryFn: () => api.get('/admin/cohort-health-board').then(r => r.data.data),
    refetchInterval: 60_000,
  });

  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => api.get('/admin/activity-feed').then(r => r.data),
    refetchInterval: 60_000,
  });

  function handleRefreshAll() { refetchDash(); refetchHealth(); refetchActivity(); }

  const kpi = dashData?.kpi;

  const kpiCards = [
    { title: 'Active Organizations', value: kpi?.active_organizations, subtitle: 'Across all plans', icon: Building2,       orbColor: '#aa78a6', onClick: () => navigate('/admin/organizations') },
    { title: 'Active Cohorts',       value: kpi?.active_cohorts,       subtitle: 'Currently running', icon: GraduationCap,   orbColor: '#3e3264', onClick: () => navigate('/admin/cohorts?status=active') },
    { title: 'Total Participants',   value: kpi?.participants?.total,   subtitle: `${kpi?.participants?.by_status?.active ?? 0} active`, icon: Users, orbColor: '#7a5090', onClick: () => navigate('/admin/users?role=PARTICIPANT') },
    { title: 'Pending Review',       value: kpi?.assessments_pending_review, subtitle: 'Needs manual scoring', icon: ClipboardCheck, orbColor: '#c8a0c4', onClick: () => navigate('/admin/assessments') },
    { title: 'Platform Alerts',      value: kpi?.platform_alerts,      subtitle: `${dashData?.alerts_detail?.inactive_participants ?? 0} inactive users`, icon: AlertTriangle, orbColor: '#e05065', onClick: () => {} },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>Platform Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7060a0' }}>Real-time view across all organizations and cohorts</p>
        </div>
        <button onClick={handleRefreshAll}
          className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw size={16} className={dashLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpiCards.map((card, i) => (
          <KpiCard key={card.title} {...card} loading={dashLoading} index={i} />
        ))}
      </div>

      {/* Main grid: health board + activity feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Cohort Health Board — 2/3 width */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-brand-400" />
              <h2 className="text-lg font-semibold text-white">Cohort Health Board</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> At risk</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> On track</span>
            </div>
          </div>

          {healthLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-card p-4 animate-pulse h-28" />
              ))}
            </div>
          ) : healthBoard?.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <GraduationCap size={40} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No active cohorts</p>
              <p className="text-slate-600 text-sm mt-1">Create and launch a cohort to see it here</p>
              <button onClick={() => navigate('/admin/cohorts')} className="btn-primary mt-4 text-sm">
                Create cohort
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(healthBoard || []).map((cohort, i) => (
                <CohortHealthCard key={cohort.id} cohort={cohort} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed — 1/3 width */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} className="text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Activity Feed</h2>
          </div>
          <div className="glass-card p-4 max-h-[520px] overflow-y-auto">
            {activityLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-slate-700 mt-2 flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-slate-700 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-800 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityData?.data?.length === 0 ? (
              <div className="text-center py-8">
                <Activity size={32} className="text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No activity yet</p>
              </div>
            ) : (
              (activityData?.data || []).map((log, i) => (
                <ActivityItem key={log.id} log={log} index={i} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alerts detail strip */}
      {dashData?.alerts_detail?.expiring_cohorts?.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4"
          style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-400" />
            <p className="text-sm font-semibold text-amber-300">Cohorts expiring within 7 days</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dashData.alerts_detail.expiring_cohorts.map(c => (
              <button key={c.id} onClick={() => navigate(`/admin/cohorts/${c.id}`)}
                className="text-xs px-3 py-1.5 rounded-lg text-amber-300 transition-colors hover:text-white"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                {c.name} — {format(new Date(c.end_date), 'MMM d')}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
