import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, GraduationCap, Bell, LogOut, Zap, Menu, User, KeyRound, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import api from '../../lib/api';
import { ChangePasswordModal } from '../ChangePasswordModal';

const navItems = [
  { to: '/participant',         icon: LayoutDashboard, label: 'My Learning',  end: true },
  { to: '/participant/profile', icon: User,            label: 'My Profile' },
];

export default function ParticipantLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch {}
    logout();
    navigate('/login');
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <motion.div
          animate={{ boxShadow: ['0 4px 16px rgba(170,120,166,0.35)', '0 4px 28px rgba(170,120,166,0.6)', '0 4px 16px rgba(170,120,166,0.35)'] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #aa78a6, #7a5090, #3e3264)' }}>
          <Zap size={17} className="text-white" />
        </motion.div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] font-semibold" style={{ color: 'var(--brand)' }}>EuRadicle</p>
          <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-heading)' }}>ELOP</p>
        </div>
      </div>

      <div className="mx-3 mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(90,140,220,0.07)', border: '1px solid rgba(90,140,220,0.2)', color: '#6496dc' }}>
        Participant
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={20} className="flex-shrink-0" />
            <span className="text-sm">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={toggleTheme} className="nav-item w-full">
          {theme === 'dark' ? <Sun size={20} className="flex-shrink-0" /> : <Moon size={20} className="flex-shrink-0" />}
          <span className="text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <button onClick={() => setShowChangePwd(true)} className="nav-item w-full">
          <KeyRound size={20} className="flex-shrink-0" />
          <span className="text-sm">Change Password</span>
        </button>

        <button onClick={handleLogout} className="nav-item w-full" style={{ color: '#e05065' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,80,101,0.1)'; e.currentTarget.style.color = '#f08090'; }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#e05065'; }}>
          <LogOut size={20} className="flex-shrink-0" />
          <span className="text-sm">Sign out</span>
        </button>

        <div className="mt-3 px-3 py-2.5 rounded-xl flex items-center gap-3"
          style={{ background: 'var(--bg-user-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6496dc, #3e3264)' }}>
            {user?.name?.[0] || 'P'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{user?.name || 'Participant'}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{user?.designation || 'Participant'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden grid-bg" style={{ background: 'var(--bg-page)' }}>
      <aside className="hidden lg:flex flex-col flex-shrink-0 w-60"
        style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 lg:hidden"
              style={{ background: 'var(--mobile-overlay)', backdropFilter: 'blur(4px)' }} />
            <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-60 z-50 lg:hidden"
              style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ background: 'var(--bg-header)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}>
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1" style={{ color: 'var(--text-faint)' }}>
            <Menu size={22} />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-xs" style={{ color: 'var(--text-ghost)' }}>
            <span>ELOP</span><span>/</span><span style={{ color: 'var(--text-muted)' }}>My Learning</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <motion.button whileHover={{ scale: 1.05 }}
              className="p-2 rounded-xl transition-all duration-200"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-faint)' }}>
              <Bell size={18} />
            </motion.button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6496dc, #3e3264)' }}>
              {user?.name?.[0] || 'P'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </div>
  );
}
