import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, UserPlus, Shield } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';

const ROLE_COLORS = {
  SUPER_ADMIN:      { bg: 'rgba(170,120,166,0.18)', text: '#d0a8e0', border: 'rgba(170,120,166,0.35)' },
  MINI_SUPER_ADMIN: { bg: 'rgba(62,50,100,0.25)',  text: '#b0a0d8', border: 'rgba(62,50,100,0.45)' },
  ORG_ADMIN:        { bg: 'rgba(122,80,144,0.18)', text: '#c0a0cc', border: 'rgba(122,80,144,0.35)' },
  PARTICIPANT:      { bg: 'rgba(64,201,128,0.12)', text: '#40c980', border: 'rgba(64,201,128,0.28)' },
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const [roleFilter, setRole] = useState(searchParams.get('role') || '');

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter],
    queryFn: () => api.get('/users', { params: { search, role: roleFilter || undefined, limit: 50 } }).then(r => r.data),
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>Users</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7060a0' }}>{data?.meta?.total ?? 0} total users</p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm"><UserPlus size={16} /> New User</button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" className="input-field pl-9 text-sm" />
        </div>
        <select value={roleFilter} onChange={e => setRole(e.target.value)} className="input-field w-44 text-sm">
          <option value="">All roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="MINI_SUPER_ADMIN">Mini Super Admin</option>
          <option value="ORG_ADMIN">Org Admin</option>
          <option value="PARTICIPANT">Participant</option>
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead><tr style={{ borderBottom: '1px solid rgba(170,120,166,0.12)' }}>
            {['User','Role','Status','Department','Last Login',''].map(h => (
              <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading ? [...Array(5)].map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(170,120,166,0.08)' }}>
                {[...Array(6)].map((_, j) => (
                  <td key={j} className="px-4 py-4"><div className="h-3 rounded animate-pulse bg-white/5" style={{ width: j===0?'60%':'40%' }} /></td>
                ))}
              </tr>
            )) : data?.data?.map((user, i) => {
              const rc = ROLE_COLORS[user.role] || ROLE_COLORS.PARTICIPANT;
              return (
                <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(170,120,166,0.08)' }}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, rgba(170,120,166,0.15), rgba(62,50,100,0.2))', border: '1px solid rgba(170,120,166,0.3)' }}>
                        {user.name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text }}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-400 capitalize">{user.status?.replace('_', ' ')}</td>
                  <td className="px-4 py-4 text-sm text-slate-500">{user.department || '—'}</td>
                  <td className="px-4 py-4 text-sm text-slate-500">
                    {user.last_login_at ? format(new Date(user.last_login_at), 'MMM d, yyyy') : 'Never'}
                  </td>
                  <td className="px-4 py-4"><Shield size={14} className="text-slate-600" /></td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && !data?.data?.length && (
          <div className="text-center py-16">
            <Users size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}
