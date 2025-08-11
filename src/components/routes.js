import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import LandingPage         from './LandingPage';
import Login               from './Login';
import Signup              from './Signup';
import CheckYourEmail      from './CheckYourEmail';
import MaintenanceReporter from './MaintenanceReporter';
import LandlordDashboard   from './LandlordDashboard';
import HelpdeskDashboard   from './HelpdeskDashboard';
import ContractorDashboard from './ContractorDashboard';
import MaintenanceLanding  from './MaintenanceLanding';
import LoginTeam           from './LoginTeam';
import ProtectedRoute      from './ProtectedRoute';
import TenantReports       from './TenantReports';

export default function AppRoutes({ session, role }) {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"                   element={<LandingPage />} />
      <Route path="/login"              element={<Login />} />
      <Route path="/signup"             element={<Signup />} />
      <Route path="/check-your-email"   element={<CheckYourEmail />} />
      <Route path="/maintenance-portal" element={<MaintenanceLanding />} />
      <Route path="/team-login" element={<LoginTeam />} />

      {/* Direct access (unprotected) to dashboards for testing */}
      <Route path="/helpdesk-dashboard" element={<HelpdeskDashboard />} />
      <Route path="/contractor-dashboard" element={<ContractorDashboard />} />

      {/* Protected Routes */}
      {/* Tenant-only */}
      <Route
        path="/report"
        element={
          <ProtectedRoute session={session} role={role} allowedRole="tenant">
            <MaintenanceReporter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-reports"
        element={
          <ProtectedRoute session={session} role={role} allowedRole="tenant">
            <TenantReports />
          </ProtectedRoute>
        }
      />

      {/* Landlord-only */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute session={session} role={role} allowedRole="landlord">
            <LandlordDashboard />
          </ProtectedRoute>
        }
      />

      {/* Helpdesk-only protected */}
      <Route
        path="/helpdesk-dashboard-protected"
        element={
          <ProtectedRoute session={session} role={role} allowedRole="helpdesk">
            <HelpdeskDashboard />
          </ProtectedRoute>
        }
      />

      {/* Contractor-only protected */}
      <Route
        path="/contractor-dashboard-protected"
        element={
          <ProtectedRoute session={session} role={role} allowedRole="contractor">
            <ContractorDashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
