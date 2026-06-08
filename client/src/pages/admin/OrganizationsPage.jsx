import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Building2, Users, GraduationCap, X, Check, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { format } from 'date-fns';

const STATUS_COLORS = {
  active:    { bg: 'rgba(26,122,74,0.12)', border: 'rgba(26,122,74,0.3)', text: '#4ade80' },
  suspended: { bg: 'rgba(192,57,43,0.12)', border: 'rgba(192,57,43,0.3)', text: '#f87171' },
  archived:  { bg: 'rgba(100,100,100,0.1)', border: 'rgba(100,100,100,0.2)', text: '#94a3b8' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.archived;
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-semibold capitalize"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {status}
    </span>
  );
}

// Create org modal
function CreateOrgModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', display_name: '', industry: '', primary_contact_name: '', primary_contact_email: '' });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => api.post('/organizations', data),
    onSuccess: () => { qc.invalidateQueries(['organizations']); onSuccess(); onClose(); },
    onError: (err) => setError(err.response?.data?.error?.message || 'Failed to create'),
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        className="glass-card w-full max-w-lg p-6"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(170,120,166,0.2)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">New Organization</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Organization Name*', key: 'name', placeholder: 'Acme Corp' },
            { label: 'Display Name*', key: 'display_name', placeholder: 'Acme Corporation' },
            { label: 'Industry', key: 'industry', placeholder: 'Financial Services' },
            { label: 'Contact Name', key: 'primary_contact_name', placeholder: 'Jane Smith' },
            { label: 'Contact Email', key: 'primary_contact_email', type: 'email', placeholder: 'jane@acme.com' },
          ].map(({ label, key, placeholder, type = 'text' }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
              <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="input-field" placeholder={placeholder} />
            </div>
          ))}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {mutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
              Create
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function OrganizationsPage() {
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', search, statusFilter],
    queryFn: () => api.get('/organizations', { params: { search, status: statusFilter || undefined, limit: 50 } }).then(r => r.data),
    keepPreviousData: true,
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>Organizations</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7060a0' }}>{data?.meta?.total ?? 0} organizations</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> New Organization
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search organizations…"
            className="input-field pl-9 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="input-field w-40 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(170,120,166,0.12)' }}>
              {['Organization', 'Industry', 'Contact', 'Status', 'Created', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(170,120,166,0.12)' }}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="h-3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)', width: j === 0 ? '60%' : '40%' }} /></td>
                  ))}
                </tr>
              ))
            ) : data?.data?.map((org, i) => (
              <motion.tr key={org.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/admin/organizations`)}
                className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: '1px solid rgba(170,120,166,0.08)' }}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, rgba(170,120,166,0.15), rgba(62,50,100,0.2))', border: '1px solid rgba(170,120,166,0.3)' }}>
                      {org.display_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{org.display_name}</p>
                      <p className="text-xs text-slate-500">{org.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-slate-400">{org.industry || '—'}</td>
                <td className="px-4 py-4">
                  <p className="text-sm text-slate-300">{org.primary_contact_name || '—'}</p>
                  <p className="text-xs text-slate-500">{org.primary_contact_email || ''}</p>
                </td>
                <td className="px-4 py-4"><StatusBadge status={org.status} /></td>
                <td className="px-4 py-4 text-sm text-slate-500">{format(new Date(org.created_at), 'MMM d, yyyy')}</td>
                <td className="px-4 py-4"><ChevronRight size={16} className="text-slate-600" /></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data?.data?.length === 0 && (
          <div className="text-center py-16">
            <Building2 size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400">No organizations found</p>
          </div>
        )}
      </div>

      <AnimatePresence>{showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} onSuccess={() => {}} />}</AnimatePresence>
    </div>
  );
}
