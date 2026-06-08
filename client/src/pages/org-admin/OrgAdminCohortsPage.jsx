import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GraduationCap, Search, ArrowRight, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';

const STATUS_STYLES = {
  active:    { bg: 'rgba(100,200,120,0.12)', color: '#64c878', border: 'rgba(100,200,120,0.25)' },
  draft:     { bg: 'rgba(170,120,166,0.1)',  color: '#aa78a6', border: 'rgba(170,120,166,0.2)' },
  completed: { bg: 'rgba(90,140,220,0.1)',   color: '#6496dc', border: 'rgba(90,140,220,0.2)' },
  archived:  { bg: 'rgba(120,120,140,0.1)',  color: '#888898', border: 'rgba(120,120,140,0.2)' },
};

const PROG_LABELS = {
  leadership_dev: 'Leadership Dev', ac_dc: 'AC / DC', behavioral: 'Behavioral',
  consulting_capability: 'Consulting', custom: 'Custom',
};

export default function OrgAdminCohortsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: cohorts = [], isLoading } = useQuery({
    queryKey: ['org-admin-cohorts'],
    queryFn: () => api.get('/org-admin/cohorts').then(r => r.data.data),
  });

  const filtered = cohorts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.cohort_code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>My Cohorts</h1>
        <p className="mt-1 text-sm" style={{ color: '#7060a0' }}>All programs assigned to your organization.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7060a0' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search cohorts…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.16)', color: '#f0e8fc' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(170,120,166,0.16)', color: '#f0e8fc' }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <GraduationCap size={40} className="mx-auto mb-3" style={{ color: '#3e2860' }} />
          <p style={{ color: '#7060a0' }}>No cohorts found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cohort, i) => (
            <motion.div key={cohort.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/org-admin/cohorts/${cohort.id}`)}
              className="glass-card p-5 cursor-pointer flex items-center gap-5 group"
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(170,120,166,0.16)'}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(170,120,166,0.12)', border: '1px solid rgba(170,120,166,0.2)' }}>
                <GraduationCap size={18} style={{ color: '#aa78a6' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold" style={{ color: '#f0e8fc' }}>{cohort.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0"
                    style={{ ...STATUS_STYLES[cohort.status] }}>
                    {cohort.status}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#7060a0' }}>
                  {cohort.cohort_code} · {PROG_LABELS[cohort.program_type] || cohort.program_type}
                </p>
              </div>
              <div className="hidden md:flex items-center gap-6 text-sm flex-shrink-0">
                <div className="flex items-center gap-1.5" style={{ color: '#7060a0' }}>
                  <Users size={13} />
                  <span>{cohort.enrollment_count} participants</span>
                </div>
                <div className="flex items-center gap-1.5" style={{ color: '#7060a0' }}>
                  <Calendar size={13} />
                  <span>
                    {cohort.start_date ? format(new Date(cohort.start_date), 'MMM d, yyyy') : '—'}
                    {cohort.end_date ? ` – ${format(new Date(cohort.end_date), 'MMM d')}` : ''}
                  </span>
                </div>
              </div>
              <ArrowRight size={16} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#aa78a6' }} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
