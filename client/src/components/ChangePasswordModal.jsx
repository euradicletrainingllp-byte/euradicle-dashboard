import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';

// ── Shared primitives ─────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: '#7a6898' }}>
      {children}
    </label>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm outline-none transition-colors"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(170,120,166,0.18)',
          color: 'var(--text-heading)',
        }}
        onFocus={e => e.target.style.borderColor = 'rgba(170,120,166,0.5)'}
        onBlur={e => e.target.style.borderColor = 'rgba(170,120,166,0.18)'}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
        style={{ color: 'var(--text-ghost)' }}
        onMouseEnter={e => e.currentTarget.style.color = '#aa78a6'}
        onMouseLeave={e => e.currentTarget.style.color = '#5a4870'}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ── Password strength indicator ───────────────────────────────────────────────
function StrengthBar({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ['#e05065', '#e09050', '#d0b840', '#40c980'];
  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score - 1] : 'rgba(255,255,255,0.06)' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color: score > 0 ? colors[score - 1] : '#5a4870' }}>
        {labels[score]}
      </p>
    </div>
  );
}

// ── Self-service modal (current + new + confirm) ──────────────────────────────
export function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/change-password', {
      current_password: form.current,
      new_password: form.newPwd,
    }),
    onSuccess: () => setDone(true),
    onError: (err) => setError(err.response?.data?.error?.message || 'Something went wrong'),
  });

  function submit() {
    setError('');
    if (!form.current) { setError('Enter your current password'); return; }
    if (form.newPwd.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (form.newPwd !== form.confirm) { setError('New passwords do not match'); return; }
    if (form.newPwd === form.current) { setError('New password must differ from current password'); return; }
    mutation.mutate();
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: 'rgba(8,8,18,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-md"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(170,120,166,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: '1px solid rgba(170,120,166,0.1)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(170,120,166,0.14)', border: '1px solid rgba(170,120,166,0.25)' }}>
            <Lock size={17} style={{ color: '#aa78a6' }} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-[var(--text-heading)] leading-tight">Change Password</h2>
            <p className="text-xs mt-0.5" style={{ color: '#6a5880' }}>Update your account password</p>
          </div>
          {!done && (
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-ghost)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
              onMouseLeave={e => e.currentTarget.style.color = '#5a4870'}>
              <X size={17} />
            </button>
          )}
        </div>

        {done ? (
          /* Success */
          <div className="px-6 py-8 text-center space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                style={{ background: 'rgba(64,201,128,0.12)', border: '2px solid rgba(64,201,128,0.3)' }}>
                <CheckCircle size={28} style={{ color: '#40c980' }} />
              </div>
            </motion.div>
            <div>
              <p className="font-bold text-[var(--text-heading)]">Password changed!</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Your password has been updated successfully.</p>
            </div>
            <button onClick={onClose} className="btn-primary w-full text-sm">Done</button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <div>
                <Label>Current Password</Label>
                <PasswordInput value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} placeholder="Your existing password" />
              </div>

              <div className="h-px" style={{ background: 'rgba(170,120,166,0.1)' }} />

              <div>
                <Label>New Password</Label>
                <PasswordInput value={form.newPwd} onChange={e => setForm(f => ({ ...f, newPwd: e.target.value }))} placeholder="At least 8 characters" />
                <StrengthBar password={form.newPwd} />
              </div>

              <div>
                <Label>Confirm New Password</Label>
                <PasswordInput value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat new password" />
                {form.confirm && form.newPwd !== form.confirm && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#e05065' }}>
                    <AlertCircle size={11} /> Passwords do not match
                  </p>
                )}
                {form.confirm && form.newPwd === form.confirm && form.confirm.length > 0 && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#40c980' }}>
                    <CheckCircle size={11} /> Passwords match
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'rgba(224,80,101,0.08)', border: '1px solid rgba(224,80,101,0.22)', color: '#e05065' }}>
                  <AlertCircle size={14} className="flex-shrink-0" /> {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button
                onClick={submit}
                disabled={mutation.isPending || !form.current || form.newPwd.length < 8 || form.newPwd !== form.confirm}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {mutation.isPending
                  ? <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                  : <Lock size={14} />}
                {mutation.isPending ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ── Admin reset modal (no current password required) ─────────────────────────
export function AdminResetPasswordModal({ targetUser, onClose }) {
  const [form, setForm] = useState({ newPwd: '', confirm: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(`/users/${targetUser.id}/reset-password`, { new_password: form.newPwd }),
    onSuccess: () => setDone(true),
    onError: (err) => setError(err.response?.data?.error?.message || 'Something went wrong'),
  });

  function submit() {
    setError('');
    if (form.newPwd.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (form.newPwd !== form.confirm) { setError('Passwords do not match'); return; }
    mutation.mutate();
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: 'rgba(8,8,18,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card w-full max-w-md"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(170,120,166,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: '1px solid rgba(170,120,166,0.1)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(224,80,101,0.12)', border: '1px solid rgba(224,80,101,0.25)' }}>
            <Lock size={17} style={{ color: '#e05065' }} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-[var(--text-heading)] leading-tight">Reset Password</h2>
            <p className="text-xs mt-0.5" style={{ color: '#6a5880' }}>
              Setting new password for <span style={{ color: '#e0c8f8' }}>{targetUser.name}</span>
            </p>
          </div>
          {!done && (
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-ghost)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f0e8fc'}
              onMouseLeave={e => e.currentTarget.style.color = '#5a4870'}>
              <X size={17} />
            </button>
          )}
        </div>

        {done ? (
          <div className="px-6 py-8 text-center space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                style={{ background: 'rgba(64,201,128,0.12)', border: '2px solid rgba(64,201,128,0.3)' }}>
                <CheckCircle size={28} style={{ color: '#40c980' }} />
              </div>
            </motion.div>
            <div>
              <p className="font-bold text-[var(--text-heading)]">Password reset!</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
                <span style={{ color: '#e0c8f8' }}>{targetUser.name}</span>'s password has been updated.
              </p>
            </div>
            <button onClick={onClose} className="btn-primary w-full text-sm">Done</button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="px-3 py-2.5 rounded-xl text-xs"
                style={{ background: 'rgba(224,80,101,0.06)', border: '1px solid rgba(224,80,101,0.15)', color: '#c06070' }}>
                This bypasses the user's current password. They will be able to log in immediately with the new password.
              </div>

              <div>
                <Label>New Password</Label>
                <PasswordInput value={form.newPwd} onChange={e => setForm(f => ({ ...f, newPwd: e.target.value }))} placeholder="At least 8 characters" />
                <StrengthBar password={form.newPwd} />
              </div>

              <div>
                <Label>Confirm New Password</Label>
                <PasswordInput value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat new password" />
                {form.confirm && form.newPwd !== form.confirm && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#e05065' }}>
                    <AlertCircle size={11} /> Passwords do not match
                  </p>
                )}
                {form.confirm && form.newPwd === form.confirm && form.confirm.length > 0 && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#40c980' }}>
                    <CheckCircle size={11} /> Passwords match
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'rgba(224,80,101,0.08)', border: '1px solid rgba(224,80,101,0.22)', color: '#e05065' }}>
                  <AlertCircle size={14} className="flex-shrink-0" /> {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button
                onClick={submit}
                disabled={mutation.isPending || form.newPwd.length < 8 || form.newPwd !== form.confirm}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={!mutation.isPending ? { background: 'rgba(224,80,101,0.18)', borderColor: 'rgba(224,80,101,0.4)', color: '#f08090' } : {}}>
                {mutation.isPending
                  ? <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                  : <Lock size={14} />}
                {mutation.isPending ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}
