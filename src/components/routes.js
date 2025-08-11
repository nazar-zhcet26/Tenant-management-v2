// src/components/routes.js
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

/**
 * AppRoutes expects `session` and `role` props from App.js
 *   <AppRoutes session={session} role={role} />
 */
export default function AppRoutes({ session, role }) {
  return (
    <Routes>
      {/* Public: default landing for tenants & landlords */}
      <Route path="/" element={<LandingPage />} />

      {/* Tenant/Landlord auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/check-email" element={<CheckYourEmail />} />

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

      {/* Maintenance Team entry + login (role picked via ?role=helpdesk|contractor) */}
      <Route path="/maintenance-portal" element={<MaintenanceLanding />} />
      <Route path="/maintenance-login" element={<LoginTeam />} />

      {/* Helpdesk-only */}
      <Route
        path="/helpdesk-dashboard"
        element={
          <ProtectedRoute session={session} role={role} allowedRole="helpdesk">
            <HelpdeskDashboard />
          </ProtectedRoute>
        }
      />

      {/* Contractor-only */}
      <Route
        path="/contractor-dashboard"
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
