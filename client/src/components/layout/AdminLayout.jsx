import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Users, GraduationCap,
  BookOpen, FileText, Bell, LogOut,
  ChevronLeft, ChevronRight, Zap, Menu, KeyRound, Sun, Moon, BarChart2,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import api from '../../lib/api';
import { ChangePasswordModal } from '../ChangePasswordModal';

const navItems = [
  { to: '/admin',               icon: LayoutDashboard, label: 'Dashboard',     end: true },
  { to: '/admin/organizations', icon: Building2,       label: 'Organizations' },
  { to: '/admin/cohorts',       icon: GraduationCap,   label: 'Cohorts'       },
  { to: '/admin/users',         icon: Users,           label: 'Users'         },
  { to: '/admin/assessments',   icon: FileText,        label: 'Assessments'   },
  { to: '/admin/content',       icon: BookOpen,        label: 'Content'       },
  { to: '/admin/analytics',     icon: BarChart2,       label: 'Analytics'     },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
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
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? 'justify-center' : ''}`}
        style={{ borderBottom: '1px solid var(--border)' }}>
        <motion.div
          animate={{ boxShadow: ['0 4px 16px rgba(170,120,166,0.35)', '0 4px 28px rgba(170,120,166,0.6)', '0 4px 16px rgba(170,120,166,0.35)'] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #aa78a6, #7a5090, #3e3264)' }}
        >
          <Zap size={17} className="text-white" />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }} className="overflow-hidden">
              <p className="text-xs uppercase tracking-[0.18em] font-semibold whitespace-nowrap" style={{ color: 'var(--brand)' }}>EuRadicle</p>
              <p className="text-sm font-bold whitespace-nowrap leading-tight" style={{ color: 'var(--text-heading)' }}>ELOP</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-3' : ''}`}
            title={collapsed ? label : undefined}
          >
            <Icon size={20} className="flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }} className="overflow-hidden whitespace-nowrap text-sm">
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={toggleTheme}
          className={`nav-item w-full ${collapsed ? 'justify-center px-3' : ''}`}
          title={collapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}>
          {theme === 'dark' ? <Sun size={20} className="flex-shrink-0" /> : <Moon size={20} className="flex-shrink-0" />}
          {!collapsed && <span className="text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <button onClick={() => setShowChangePwd(true)}
          className={`nav-item w-full ${collapsed ? 'justify-center px-3' : ''}`}
          title={collapsed ? 'Change Password' : undefined}>
          <KeyRound size={20} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm">Change Password</span>}
        </button>

        <button onClick={handleLogout}
          className={`nav-item w-full ${collapsed ? 'justify-center px-3' : ''}`}
          title={collapsed ? 'Sign out' : undefined}
          style={{ color: '#e05065' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,80,101,0.1)'; e.currentTarget.style.color = '#f08090'; }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#e05065'; }}>
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm">Sign out</span>}
        </button>

        {!collapsed && (
          <div className="mt-3 px-3 py-2.5 rounded-xl flex items-center gap-3"
            style={{ background: 'var(--bg-user-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #aa78a6, #3e3264)' }}>
              {user?.name?.[0] || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{user?.name || 'Admin'}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden grid-bg" style={{ background: 'var(--bg-page)' }}>
      <motion.aside
        animate={{ width: collapsed ? 80 : 256 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col flex-shrink-0 relative"
        style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>
        <SidebarContent />
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-16 w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all duration-200"
          style={{ background: 'var(--bg-mid)', border: '1px solid var(--border-mid)', color: 'var(--text-muted)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#aa78a6'; e.currentTarget.style.borderColor = 'rgba(170,120,166,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)'; }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 lg:hidden"
              style={{ background: 'var(--mobile-overlay)', backdropFilter: 'blur(4px)' }} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-64 z-50 lg:hidden"
              style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ background: 'var(--bg-header)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}>
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1 transition-colors"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-body)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
            <Menu size={22} />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-xs" style={{ color: 'var(--text-ghost)' }}>
            <span>ELOP</span><span>/</span>
            <span style={{ color: 'var(--text-muted)' }}>Admin</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <motion.button whileHover={{ scale: 1.05 }}
              className="relative p-2 rounded-xl transition-all duration-200"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-faint)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(170,120,166,0.35)'; e.currentTarget.style.color = 'var(--text-body)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-faint)'; }}>
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: '#aa78a6', boxShadow: '0 0 6px rgba(170,120,166,0.8)' }} />
            </motion.button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #aa78a6, #3e3264)' }}>
              {user?.name?.[0] || 'A'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </div>
  );
}
