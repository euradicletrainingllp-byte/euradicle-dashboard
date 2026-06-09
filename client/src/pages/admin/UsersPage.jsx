import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Users, UserPlus, Shield, X, Check, CheckCircle,
  Copy, AlertCircle, Building2, Edit2,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_META = {
  SUPER_ADMIN:      { label: 'Super Admin',      bg: 'rgba(170,120,166,0.18)', text: '#d0a8e0', border: 'rgba(170,120,166,0.35)', requiresOrg: false },
  MINI_SUPER_ADMIN: { label: 'Mini Super Admin', bg: 'rgba(62,50,100,0.25)',   text: '#b0a0d8', border: 'rgba(62,50,100,0.45)',   requiresOrg: false },
  ORG_ADMIN:        { label: 'Org Admin',        bg: 'rgba(122,80,144,0.18)', text: '#c0a0cc', border: 'rgba(122,80,144,0.35)', requiresOrg: true  },
  PARTICIPANT:      { label: 'Participant',       bg: 'rgba(64,201,128,0.12)', text: '#40c980', border: 'rgba(64,201,128,0.28)', requiresOrg: true  },
};

const ROLE_LIST = [
  { value: 'PARTICIPANT',      ...ROLE_META.PARTICIPANT },
  { value: 'ORG_ADMIN',        ...ROLE_META.ORG_ADMIN },
  { value: 'MINI_SUPER_ADMIN', ...ROLE_META.MINI_SUPER_ADMIN },
  { value: 'SUPER_ADMIN',      ...ROLE_META.SUPER_ADMIN },
];

const STATUS_OPTS = [
  { value: 'active',               label: 'Active' },
  { value: 'pending_first_login',  label: 'Pending First Login' },
  { value: 'inactive',             label: 'Inactive' },
  { value: 'suspended',            label: 'Suspended' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: '#7a6898' }}>
      {children}{required && <span className="text-red-400 ml-0.5 normal-case">*</span>}
    </label>
  );
}

function InputEl({ ...props }) {
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

function SelectEl({ children, ...props }) {
  return (
    <select {...props}
      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(170,120,166,0.18)',
        color: '#f0e8fc',
      }}>
      {children}
    </select>
  );
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: 'rgba(170,120,166,0.1)' }} />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a3860' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(170,120,166,0.1)' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal portal wrapper
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
// Success screen (create only)
// ─────────────────────────────────────────────────────────────────────────────
function CreatedSuccess({ user, tempPassword, onClose, onAnother }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(tempPassword).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="px-6 py-8 text-center space-y-5">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: 'rgba(64,201,128,0.12)', border: '2px solid rgba(64,201,128,0.3)' }}>
          <CheckCircle size={30} style={{ color: '#40c980' }} />
        </div>
      </motion.div>

      <div>
        <h3 className="text-lg font-bold text-white">Account Created!</h3>
        <p className="text-sm mt-1" style={{ color: '#7060a0' }}>
          <span style={{ color: '#f0e8fc' }}>{user?.name}</span> is ready to log in.
        </p>
      </div>

      <div className="rounded-2xl p-4 text-left"
        style={{ background: 'rgba(170,120,166,0.06)', border: '1px solid rgba(170,120,166,0.18)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: '#7060a0' }}>
          Temporary Password — share securely
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-bold px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#e0d0f8', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
            {tempPassword}
          </code>
          <button onClick={copy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
            style={{
              background: copied ? 'rgba(64,201,128,0.12)' : 'rgba(170,120,166,0.1)',
              color: copied ? '#40c980' : '#aa78a6',
              border: `1px solid ${copied ? 'rgba(64,201,128,0.28)' : 'rgba(170,120,166,0.22)'}`,
            }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: '#4a3860' }}>
          The user will be prompted to set a new password on first login.
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onAnother} className="btn-ghost flex-1 text-sm">Create Another</button>
        <button onClick={onClose} className="btn-primary flex-1 text-sm">Done</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Org required selector
// ─────────────────────────────────────────────────────────────────────────────
function OrgSelector({ value, onChange, orgs, loading, roleLabel }) {
  const hasOrg = !!value;
  return (
    <div className="rounded-xl p-4 space-y-2.5"
      style={{
        background: hasOrg ? 'rgba(64,201,128,0.04)' : 'rgba(224,80,101,0.04)',
        border: `1px solid ${hasOrg ? 'rgba(64,201,128,0.2)' : 'rgba(224,80,101,0.22)'}`,
      }}>
      <div className="flex items-center gap-2">
        <Building2 size={13} style={{ color: hasOrg ? '#40c980' : '#e05065' }} />
        <span className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: hasOrg ? '#40c980' : '#e05065' }}>
          Organization — {hasOrg ? 'Assigned' : 'Required'}
        </span>
      </div>
      <SelectEl value={value} onChange={e => onChange(e.target.value)} disabled={loading}>
        <option value="">{loading ? 'Loading…' : '— Select Organization —'}</option>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.display_name}</option>)}
      </SelectEl>
      {!hasOrg && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#e05065' }}>
          <AlertCircle size={11} /> {roleLabel} must be assigned to an organization.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User modal (create + edit)
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_USER = {
  name: '', email: '', role: 'PARTICIPANT', org_id: '',
  designation: '', department: '', employee_id: '', phone: '', manager_name: '',
  status: 'pending_first_login',
};

function UserModal({ mode = 'create', user, onClose }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(
    isEdit
      ? {
          name:         user.name         || '',
          email:        user.email        || '',
          role:         user.role         || 'PARTICIPANT',
          org_id:       user.org_id       || '',
          designation:  user.designation  || '',
          department:   user.department   || '',
          employee_id:  user.employee_id  || '',
          phone:        user.phone        || '',
          manager_name: user.manager_name || '',
          status:       user.status       || 'active',
        }
      : { ...EMPTY_USER }
  );
  const [error, setError]   = useState('');
  const [created, setCreated] = useState(null);
  const qc = useQueryClient();

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['organizations-dropdown'],
    queryFn: () => api.get('/organizations', { params: { limit: 100, status: 'active' } }).then(r => r.data),
    staleTime: 60_000,
  });
  const orgs = orgsData?.data || [];

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const roleInfo = ROLE_META[form.role] || ROLE_META.PARTICIPANT;
  const needsOrg = roleInfo.requiresOrg;

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.patch(`/users/${user.id}`, data)
        : api.post('/users', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      if (isEdit) {
        onClose();
      } else {
        setCreated(res.data);
      }
    },
    onError: (err) => setError(err.response?.data?.error?.message || 'Something went wrong'),
  });

  function submit() {
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!isEdit && !form.email.trim()) { setError('Email is required'); return; }
    if (!isEdit && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Invalid email address'); return; }
    if (needsOrg && !form.org_id) { setError(`Organization is required for ${roleInfo.label}`); return; }

    const payload = {
      name:         form.name.trim(),
      role:         form.role,
      org_id:       form.org_id || undefined,
      designation:  form.designation  || undefined,
      department:   form.department   || undefined,
      employee_id:  form.employee_id  || undefined,
      phone:        form.phone        || undefined,
      manager_name: form.manager_name || undefined,
    };
    if (!isEdit) payload.email = form.email.trim().toLowerCase();
    if (isEdit)  payload.status = form.status;

    mutation.mutate(payload);
  }

  function reset() {
    setCreated(null);
    setForm({ ...EMPTY_USER });
    setError('');
  }

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
            style={{ background: 'rgba(170,120,166,0.14)', border: '1px solid rgba(170,120,166,0.25)' }}>
            <UserPlus size={17} style={{ color: '#aa78a6' }} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-white leading-tight">
              {isEdit ? 'Edit User' : 'New User Account'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#6a5880' }}>
              {isEdit ? `Editing ${user.name}` : 'Create a participant or admin account'}
            </p>
          </div>
          {!created && (
            <button onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#5a4870' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
              onMouseLeave={e => e.currentTarget.style.color = '#5a4870'}>
              <X size={17} />
            </button>
          )}
        </div>

        {/* Success screen */}
        {created ? (
          <CreatedSuccess
            user={created.data}
            tempPassword={created.temp_password}
            onClose={onClose}
            onAnother={reset}
          />
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">

              {/* Role picker */}
              <div>
                <Label required>Role</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_LIST.map(r => {
                    const sel = form.role === r.value;
                    return (
                      <button key={r.value}
                        onClick={() => set('role', r.value)}
                        className="px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all"
                        style={{
                          background: sel ? r.bg : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${sel ? r.border : 'rgba(170,120,166,0.1)'}`,
                          color: sel ? r.text : '#5a4870',
                        }}>
                        {r.label}
                        {r.requiresOrg && (
                          <span className="ml-1 opacity-55 font-normal normal-case">(org req.)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Org selector — conditional */}
              {needsOrg && (
                <OrgSelector
                  value={form.org_id}
                  onChange={v => set('org_id', v)}
                  orgs={orgs}
                  loading={orgsLoading}
                  roleLabel={roleInfo.label}
                />
              )}

              <Divider label="Identity" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label required>Full Name</Label>
                  <InputEl value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" />
                </div>
                <div>
                  <Label required={!isEdit}>Email</Label>
                  <InputEl
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="jane@company.com"
                    disabled={isEdit}
                    style={isEdit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  />
                </div>
              </div>

              <Divider label="Profile" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Designation</Label>
                  <InputEl value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="Sr. Manager" />
                </div>
                <div>
                  <Label>Department</Label>
                  <InputEl value={form.department} onChange={e => set('department', e.target.value)} placeholder="Operations" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Employee ID</Label>
                  <InputEl value={form.employee_id} onChange={e => set('employee_id', e.target.value)} placeholder="EMP-001" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <InputEl type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
                </div>
              </div>

              <div>
                <Label>Manager Name</Label>
                <InputEl value={form.manager_name} onChange={e => set('manager_name', e.target.value)} placeholder="Reporting manager's name" />
              </div>

              {/* Status — edit only */}
              {isEdit && (
                <div>
                  <Label>Account Status</Label>
                  <SelectEl value={form.status} onChange={e => set('status', e.target.value)}>
                    {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </SelectEl>
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
                disabled={
                  mutation.isPending ||
                  !form.name.trim() ||
                  (!isEdit && !form.email.trim()) ||
                  (needsOrg && !form.org_id)
                }
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {mutation.isPending
                  ? <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                  : isEdit ? <Check size={15} /> : <UserPlus size={15} />}
                {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </ModalBackdrop>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [search, setSearch]     = useState('');
  const [searchParams]          = useSearchParams();
  const [roleFilter, setRole]   = useState(searchParams.get('role') || '');
  const [modal, setModal]       = useState(null); // null | { type:'create'|'edit', user? }

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter],
    queryFn: () =>
      api.get('/users', { params: { search, role: roleFilter || undefined, limit: 50 } }).then(r => r.data),
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 page-enter">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow" style={{ color: '#f0e8fc' }}>Users</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7060a0' }}>{data?.meta?.total ?? 0} total users</p>
        </div>
        <button onClick={() => setModal({ type: 'create' })} className="btn-primary flex items-center gap-2 text-sm">
          <UserPlus size={15} /> New User
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5a4870' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search users…" className="input-field pl-9 text-sm w-full" />
        </div>
        <select value={roleFilter} onChange={e => setRole(e.target.value)} className="input-field w-44 text-sm">
          <option value="">All roles</option>
          {ROLE_LIST.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(170,120,166,0.12)' }}>
              {['User', 'Role', 'Status', 'Department', 'Last Login', ''].map(h => (
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
                    {[160, 90, 80, 90, 100, 40].map((w, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 rounded-md animate-pulse"
                          style={{ background: 'rgba(255,255,255,0.05)', width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.data?.map((user, i) => {
                  const rm = ROLE_META[user.role] || ROLE_META.PARTICIPANT;
                  return (
                    <motion.tr key={user.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}
                      className="group transition-colors"
                      style={{ borderBottom: '1px solid rgba(170,120,166,0.08)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(170,120,166,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, rgba(170,120,166,0.18), rgba(62,50,100,0.25))', border: '1px solid rgba(170,120,166,0.28)' }}>
                            {user.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{user.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#5a4870' }}>{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                          style={{ background: rm.bg, border: `1px solid ${rm.border}`, color: rm.text }}>
                          {rm.label}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs capitalize" style={{ color: '#9080a8' }}>
                          {user.status?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm" style={{ color: '#5a4870' }}>
                        {user.department || <span style={{ color: '#3a3050' }}>—</span>}
                      </td>

                      <td className="px-5 py-4 text-sm" style={{ color: '#5a4870' }}>
                        {user.last_login_at ? format(new Date(user.last_login_at), 'MMM d, yyyy') : 'Never'}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setModal({ type: 'edit', user })}
                            title="Edit user"
                            className="p-2 rounded-lg transition-all"
                            style={{ color: '#7060a0' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170,120,166,0.12)'; e.currentTarget.style.color = '#f0e8fc'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7060a0'; }}>
                            <Edit2 size={14} />
                          </button>
                          <Shield size={14} style={{ color: '#2a2040', marginLeft: 2 }} />
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
            }
          </tbody>
        </table>

        {!isLoading && !data?.data?.length && (
          <div className="text-center py-16">
            <Users size={40} className="mx-auto mb-3" style={{ color: '#2a2040' }} />
            <p className="font-medium" style={{ color: '#5a4870' }}>No users found</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal?.type === 'create' && (
          <UserModal mode="create" onClose={() => setModal(null)} />
        )}
        {modal?.type === 'edit' && modal.user && (
          <UserModal mode="edit" user={modal.user} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
