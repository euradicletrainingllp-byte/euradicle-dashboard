import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import ParticleField from '../../components/3d/ParticleField';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { login }   = useAuthStore();
  const navigate    = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.access_token, data.user);
      const role = data.user.role;
      if (role === 'SUPER_ADMIN' || role === 'MINI_SUPER_ADMIN') navigate('/admin');
      else if (role === 'ORG_ADMIN') navigate('/org-admin');
      else navigate('/participant');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden grid-bg"
      style={{ background: '#15162a' }}>

      {/* 3D background */}
      <ParticleField />

      {/* Gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full animate-orb-pulse"
          style={{ background: 'radial-gradient(circle, rgba(170,120,166,0.18) 0%, transparent 65%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full animate-drift-slow"
          style={{ background: 'radial-gradient(circle, rgba(62,50,100,0.25) 0%, transparent 65%)', filter: 'blur(48px)' }} />
        <div className="absolute top-3/4 left-1/2 w-[300px] h-[300px] rounded-full animate-drift-med"
          style={{ background: 'radial-gradient(circle, rgba(122,80,144,0.15) 0%, transparent 65%)', filter: 'blur(36px)' }} />
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div style={{
          background: 'linear-gradient(145deg, rgba(36,37,56,0.96) 0%, rgba(30,28,52,0.92) 100%)',
          border: '1px solid rgba(170,120,166,0.22)',
          borderRadius: '1.5rem',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 12px 80px rgba(62,50,100,0.55), 0 0 0 1px rgba(170,120,166,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
          padding: '2.5rem',
        }}>

          {/* Logo */}
          <div className="flex items-center gap-4 mb-10">
            <motion.div
              animate={{ boxShadow: ['0 4px 24px rgba(170,120,166,0.4)', '0 4px 40px rgba(170,120,166,0.7)', '0 4px 24px rgba(170,120,166,0.4)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #aa78a6 0%, #7a5090 50%, #3e3264 100%)' }}
            >
              <Zap size={22} className="text-white" />
            </motion.div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-0.5"
                style={{ color: '#aa78a6' }}>EuRadicle</p>
              <p className="text-sm font-bold leading-tight" style={{ color: '#f0e8fc' }}>Learning Operations Platform</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-1.5 text-glow" style={{ color: '#f0e8fc' }}>Welcome back</h1>
          <p className="text-sm mb-8" style={{ color: '#9080a8' }}>Sign in to your ELOP account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: '#9080a8' }}>
                Email address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="you@company.com" required autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: '#9080a8' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pr-12" placeholder="••••••••" required
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#7060a0' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#c0a8e0'}
                  onMouseLeave={e => e.currentTarget.style.color = '#7060a0'}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(224,80,101,0.1)', border: '1px solid rgba(224,80,101,0.25)', color: '#f08090' }}>
                {error}
              </motion.div>
            )}

            <motion.button type="submit" disabled={loading}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              style={{ height: '3rem', fontSize: '0.95rem' }}>
              {loading ? (
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: 'white' }} />
              ) : (
                <><LogIn size={18} /> Sign in</>
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <a href="#" className="text-sm transition-colors" style={{ color: '#aa78a6' }}
              onMouseEnter={e => e.currentTarget.style.color = '#d0a8cc'}
              onMouseLeave={e => e.currentTarget.style.color = '#aa78a6'}>
              Forgot your password?
            </a>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: '#5a4870' }}>ELOP v1.0 · Phase 1 MVP</p>
      </motion.div>
    </div>
  );
}
