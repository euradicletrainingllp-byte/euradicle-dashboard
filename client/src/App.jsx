import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layouts
import AdminLayout from './components/layout/AdminLayout';
import OrgAdminLayout from './components/layout/OrgAdminLayout';
import ParticipantLayout from './components/layout/ParticipantLayout';

// Super Admin pages
import LoginPage from './pages/auth/LoginPage';
import SuperAdminDashboard from './pages/admin/SuperAdminDashboard';
import OrganizationsPage from './pages/admin/OrganizationsPage';
import CohortsPage from './pages/admin/CohortsPage';
import CohortDetailPage from './pages/admin/CohortDetailPage';
import UsersPage from './pages/admin/UsersPage';
import AssessmentsPage from './pages/admin/AssessmentsPage';
import ContentPage from './pages/admin/ContentPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';

// Org Admin pages
import OrgAdminDashboard from './pages/org-admin/OrgAdminDashboard';
import OrgAdminCohortsPage from './pages/org-admin/OrgAdminCohortsPage';
import OrgAdminCohortDetail from './pages/org-admin/OrgAdminCohortDetail';

// Participant pages
import ParticipantDashboard from './pages/participant/ParticipantDashboard';
import ParticipantCohortPage from './pages/participant/ParticipantCohortPage';

// ── Route guard ───────────────────────────────────────────────────────────────
function PrivateRoute({ children, roles }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/unauthorized" replace />;
  return children;
}

// ── Role-based home redirect ──────────────────────────────────────────────────
function RoleHome() {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  const role = user?.role;
  if (role === 'SUPER_ADMIN' || role === 'MINI_SUPER_ADMIN') return <Navigate to="/admin" replace />;
  if (role === 'ORG_ADMIN') return <Navigate to="/org-admin" replace />;
  if (role === 'PARTICIPANT') return <Navigate to="/participant" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Super Admin / Mini Super Admin */}
        <Route path="/admin" element={
          <PrivateRoute roles={['SUPER_ADMIN', 'MINI_SUPER_ADMIN']}>
            <AdminLayout />
          </PrivateRoute>
        }>
          <Route index element={<SuperAdminDashboard />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="cohorts" element={<CohortsPage />} />
          <Route path="cohorts/:id" element={<CohortDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="assessments" element={<AssessmentsPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>

        {/* Org Admin */}
        <Route path="/org-admin" element={
          <PrivateRoute roles={['ORG_ADMIN']}>
            <OrgAdminLayout />
          </PrivateRoute>
        }>
          <Route index element={<OrgAdminDashboard />} />
          <Route path="cohorts" element={<OrgAdminCohortsPage />} />
          <Route path="cohorts/:id" element={<OrgAdminCohortDetail />} />
          <Route path="team" element={
            <div className="p-6 text-center" style={{ color: '#7060a0' }}>
              <p className="mt-12">Team management coming soon.</p>
            </div>
          } />
        </Route>

        {/* Participant */}
        <Route path="/participant" element={
          <PrivateRoute roles={['PARTICIPANT']}>
            <ParticipantLayout />
          </PrivateRoute>
        }>
          <Route index element={<ParticipantDashboard />} />
          <Route path="cohorts/:id" element={<ParticipantCohortPage />} />
          <Route path="profile" element={
            <div className="p-6 text-center" style={{ color: '#7060a0' }}>
              <p className="mt-12">Profile page coming soon.</p>
            </div>
          } />
        </Route>

        {/* Root redirect by role */}
        <Route path="/" element={<RoleHome />} />
        <Route path="/unauthorized" element={
          <div className="flex items-center justify-center h-screen" style={{ background: '#15162a', color: '#7060a0' }}>
            <div className="text-center">
              <p className="text-4xl font-bold mb-2" style={{ color: '#aa78a6' }}>403</p>
              <p className="mb-4">You don't have access to this area.</p>
              <a href="/login" className="text-sm underline" style={{ color: '#aa78a6' }}>Go to Login</a>
            </div>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}
