import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, GraduationCap, Users, Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';

const HEALTH_COLORS = {
  green: '#4ade80', amber: '#fbbf24', red: '#f87171', grey: '#64748b'
};

const STATUS_STYLES = {
  draft:     { bg: 'rgba(150,140,200,0.12)', text: '#b8aad8', border: 'rgba(150,140,200,0.22)' },
  active:    { bg: 'rgba(64,201,128,0.12)',  text: '#40c980', border: 'rgba(64,201,128,0.25)' },
  completed: { bg: 'rgba(62,50,100,0.28)',   text: '#a898cc', border: 'rgba(62,50,100,0.5)' },
  archived:  { bg: 'rgba(90,80,112,0.18)',   text: '#7a708a', border: 'rgba(90,80,112,0.3)' },
};

export default function CohortsPage() {
  const [search, setSearch] = useState('');
  const [searchParams]      = useSearchParams();
  const [statusFilter, setStatus] = useState(searchParams.get('status') || '');
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['cohorts', search, statusFilter],
    queryFn: () => api.get('/cohorts', { params: { search, status: statusFilter || undefined, limit: 50 } }).then(r => r.data),
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>Cohorts</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7060a0' }}>{data?.meta?.total ?? 0} total cohorts</p>
        </div>
        <button onClick={() => navigate('/admin/cohorts/new')} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> New Cohort
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cohorts…" className="input-field pl-9 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="input-field w-40 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? [...Array(6)].map((_, i) => <div key={i} className="glass-card h-48 animate-pulse" />) :
          data?.data?.map((cohort, i) => {
            const st = STATUS_STYLES[cohort.status] || STATUS_STYLES.archived;
            const hc = HEALTH_COLORS[cohort.health_label] || '#64748b';
            return (
              <motion.div key={cohort.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} onClick={() => navigate(`/admin/cohorts/${cohort.id}`)}
                className="glass-card-hover p-5 cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold capitalize"
                    style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>
                    {cohort.status}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ background: hc, boxShadow: `0 0 4px ${hc}` }} />
                    {cohort.health_label}
                  </div>
                </div>
                <h3 className="font-bold text-white mb-0.5 line-clamp-1">{cohort.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{cohort.organizations?.display_name} · {cohort.cohort_code}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><Users size={12} />{cohort.enrollment_count ?? 0} enrolled</span>
                  <span className="flex items-center gap-1.5"><Clock size={12} />{cohort.end_date ? format(new Date(cohort.end_date), 'MMM d, yyyy') : '—'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-600 capitalize">{cohort.program_type?.replace('_', ' ')}</span>
                  <ChevronRight size={16} className="text-slate-600" />
                </div>
              </motion.div>
            );
          })
        }
      </div>

      {!isLoading && data?.data?.length === 0 && (
        <div className="glass-card p-16 text-center">
          <GraduationCap size={48} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-300 font-semibold">No cohorts found</p>
          <p className="text-slate-500 text-sm mt-1">Create your first cohort to get started</p>
          <button className="btn-primary mt-6 text-sm flex items-center gap-2 mx-auto"><Plus size={16} /> Create Cohort</button>
        </div>
      )}
    </div>
  );
}
