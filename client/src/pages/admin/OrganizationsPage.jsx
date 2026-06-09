import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Building2, X, Check, ChevronRight,
  Edit2, Trash2, AlertCircle, Phone, Mail, User, Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_OPTS = ['active', 'suspended', 'archived'];

const STATUS_COLORS = {
  active:    { bg: 'rgba(64,201,128,0.12)',  border: 'rgba(64,201,128,0.28)',  text: '#40c980' },
  suspended: { bg: 'rgba(224,80,101,0.12)',  border: 'rgba(224,80,101,0.28)',  text: '#e05065' },
  archived:  { bg: 'rgba(90,80,112,0.14)',   border: 'rgba(90,80,112,0.28)',   text: '#7a708a' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.archived;
  return (
    <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared field label
// ─────────────────────────────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: '#7a6898' }}>
      {children}{required && <span className="text-red-400 ml-0.5 normal-case">*</span>}
    </label>
  );
}

function InputField({ ...props }) {
  return (
    <input {...props}
      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(170,120,166,0.18)',
        color: '#f0e8fc',
      }}
      onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
      onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.18)'}
    />
  );
}

function SelectField({ children, ...props }) {
  return (
    <select {...props}
      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
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
// Modal portal wrapper — renders to document.body, handles scroll
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
// Org modal (create + edit)
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY = {
  name: '', display_name: '', industry: '',
  primary_contact_name: '', primary_contact_email: '', primary_contact_phone: '',
  status: 'active',
};

function OrgModal({ mode = 'create', org, onClose }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(
    isEdit
      ? {
          name:                  org.name                  || '',
          display_name:          org.display_name          || '',
          industry:              org.industry              || '',
          primary_contact_name:  org.primary_contact_name  || '',
          primary_contact_email: org.primary_contact_email || '',
          primary_contact_phone: org.primary_contact_phone || '',
          status:                org.status                || 'active',
        }
      : { ...EMPTY }
  );
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.patch(`/organizations/${org.id}`, data)
        : api.post('/organizations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.error?.message || 'Something went wrong'),
  });

  function submit() {
    setError('');
    if (!form.display_name.trim()) { setError('Display name is required'); return; }
    if (!isEdit && !form.name.trim()) { setError('Organization name is required'); return; }
    mutation.mutate(form);
  }

  const iconColor = isEdit ? '#6496dc' : '#aa78a6';

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div
        initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-lg"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(170,120,166,0.2)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: '1px solid rgba(170,120,166,0.1)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}>
            <Building2 size={17} style={{ color: iconColor }} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-white leading-tight">
              {isEdit ? 'Edit Organization' : 'New Organization'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#6a5880' }}>
              {isEdit ? `Editing ${org.display_name}` : 'Create a new organization on the platform'}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg transition-colors ml-2"
            style={{ color: '#5a4870' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
            onMouseLeave={e => e.currentTarget.style.color = '#5a4870'}>
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div className={isEdit ? 'col-span-2' : ''}>
              <Label required>Display Name</Label>
              <InputField
                value={form.display_name}
                onChange={e => set('display_name', e.target.value)}
                placeholder="Acme Corporation" />
            </div>
            {!isEdit && (
              <div>
                <Label required>Short Name / Slug base</Label>
                <InputField
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="acme-corp" />
              </div>
            )}
          </div>

          <div>
            <Label>Industry</Label>
            <InputField
              value={form.industry}
              onChange={e => set('industry', e.target.value)}
              placeholder="e.g., Financial Services, Healthcare, FMCG" />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px" style={{ background: 'rgba(170,120,166,0.1)' }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#5a4870' }}>
              Primary Contact
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(170,120,166,0.1)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact Name</Label>
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5a4870' }} />
                <InputField
                  value={form.primary_contact_name}
                  onChange={e => set('primary_contact_name', e.target.value)}
                  placeholder="Jane Smith"
                  style={{ paddingLeft: '2rem' }} />
              </div>
            </div>
            <div>
              <Label>Phone</Label>
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5a4870' }} />
                <InputField
                  value={form.primary_contact_phone}
                  onChange={e => set('primary_contact_phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  style={{ paddingLeft: '2rem' }} />
              </div>
            </div>
          </div>

          <div>
            <Label>Contact Email</Label>
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5a4870' }} />
              <InputField
                type="email"
                value={form.primary_contact_email}
                onChange={e => set('primary_contact_email', e.target.value)}
                placeholder="jane@acme.com"
                style={{ paddingLeft: '2rem' }} />
            </div>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <Label>Status</Label>
              <SelectField value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPTS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </SelectField>
            </div>
          )}

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
            disabled={mutation.isPending}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {mutation.isPending
              ? <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
              : <Check size={15} />}
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Organization'}
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirm modal
// ─────────────────────────────────────────────────────────────────────────────
function DeleteOrgModal({ org, onClose }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.delete(`/organizations/${org.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      onClose();
    },
  });

  return (
    <ModalBackdrop onClose={onClose}>
      <motion.div
        initial={{ scale: 0.96, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-sm p-6 text-center"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(224,80,101,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(224,80,101,0.12)', border: '1px solid rgba(224,80,101,0.28)' }}>
          <Trash2 size={20} style={{ color: '#e05065' }} />
        </div>
        <h3 className="font-bold text-white mb-1">Archive Organization</h3>
        <p className="text-sm mb-5" style={{ color: '#7060a0' }}>
          Archive <span style={{ color: '#f0e8fc' }}>{org.display_name}</span>? Cohorts and users linked to this org will remain intact.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 text-sm px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'rgba(224,80,101,0.15)', border: '1px solid rgba(224,80,101,0.3)', color: '#e05065' }}>
            {mutation.isPending ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Trash2 size={14} />}
            Archive
          </button>
        </div>
      </motion.div>
    </ModalBackdrop>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function OrganizationsPage() {
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [modal, setModal]           = useState(null); // null | { type: 'create'|'edit'|'delete', org? }

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', search, statusFilter],
    queryFn: () =>
      api.get('/organizations', {
        params: { search, status: statusFilter || undefined, limit: 50 },
      }).then(r => r.data),
  });

  const orgs = data?.data || [];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 page-enter">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>Organizations</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7060a0' }}>
            {data?.meta?.total ?? 0} organizations on the platform
          </p>
        </div>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> New Organization
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5a4870' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search organizations…"
            className="input-field pl-9 text-sm w-full" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="input-field w-40 text-sm">
          <option value="">All statuses</option>
          {STATUS_OPTS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(170,120,166,0.12)' }}>
              {['Organization', 'Industry', 'Primary Contact', 'Status', 'Created', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider px-5 py-3.5"
                  style={{ color: '#5a4870' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(170,120,166,0.08)' }}>
                    {[160, 100, 140, 70, 90, 40].map((w, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 rounded-md animate-pulse"
                          style={{ background: 'rgba(255,255,255,0.05)', width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              : orgs.map((org, i) => (
                  <motion.tr
                    key={org.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="group transition-colors"
                    style={{ borderBottom: '1px solid rgba(170,120,166,0.08)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(170,120,166,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                    {/* Org name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, rgba(170,120,166,0.2), rgba(62,50,100,0.3))', border: '1px solid rgba(170,120,166,0.28)' }}>
                          {org.display_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{org.display_name}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#5a4870' }}>{org.slug}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm" style={{ color: '#9080a8' }}>
                      {org.industry || <span style={{ color: '#3a3050' }}>—</span>}
                    </td>

                    <td className="px-5 py-4">
                      {org.primary_contact_name
                        ? <>
                            <p className="text-sm" style={{ color: '#c8b8e0' }}>{org.primary_contact_name}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#5a4870' }}>{org.primary_contact_email}</p>
                          </>
                        : <span className="text-sm" style={{ color: '#3a3050' }}>—</span>
                      }
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={org.status} />
                    </td>

                    <td className="px-5 py-4 text-sm" style={{ color: '#5a4870' }}>
                      {format(new Date(org.created_at), 'MMM d, yyyy')}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ type: 'edit', org })}
                          title="Edit"
                          className="p-2 rounded-lg transition-all"
                          style={{ color: '#7060a0' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.12)'; e.currentTarget.style.color = '#f0e8fc'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7060a0'; }}>
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setModal({ type: 'delete', org })}
                          title="Archive"
                          className="p-2 rounded-lg transition-all"
                          style={{ color: '#7060a0' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,80,101,0.1)'; e.currentTarget.style.color = '#e05065'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7060a0'; }}>
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={14} style={{ color: '#3a3050' }} />
                      </div>
                    </td>
                  </motion.tr>
                ))
            }
          </tbody>
        </table>

        {!isLoading && orgs.length === 0 && (
          <div className="text-center py-16">
            <Building2 size={40} className="mx-auto mb-3" style={{ color: '#2a2040' }} />
            <p className="font-medium" style={{ color: '#5a4870' }}>No organizations found</p>
            <p className="text-sm mt-1" style={{ color: '#3a3050' }}>
              {search ? 'Try a different search term' : 'Create your first organization to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal?.type === 'create' && (
          <OrgModal mode="create" onClose={() => setModal(null)} />
        )}
        {modal?.type === 'edit' && modal.org && (
          <OrgModal mode="edit" org={modal.org} onClose={() => setModal(null)} />
        )}
        {modal?.type === 'delete' && modal.org && (
          <DeleteOrgModal org={modal.org} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
