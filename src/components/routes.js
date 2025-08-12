// src/components/routes.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import LandingPage         from './LandingPage';
import Login               from './Login';
import Signup              from './Signup';
import CheckYourEmail      from './CheckYourEmail';

import MaintenanceReporter from './MaintenanceReporter';     // tenant
import TenantReports       from './TenantReports';           // tenant
import LandlordDashboard   from './LandlordDashboard';       // landlord

import MaintenanceLanding  from './MaintenanceLanding';      // maintenance portal splash
import LoginTeam           from './LoginTeam';               // maintenance login
import HelpdeskDashboard   from './HelpdeskDashboard';       // helpdesk
import ContractorDashboard from './ContractorDashboard';     // contractor

import ProtectedRoute      from './ProtectedRoute';

export default function AppRoutes() {
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
          <ProtectedRoute allowed={['tenant']} fallback="/login">
            <MaintenanceReporter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-reports"
        element={
          <ProtectedRoute allowed={['tenant']} fallback="/login">
            <TenantReports />
          </ProtectedRoute>
        }
      />

      {/* Landlord-only */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowed={['landlord']} fallback="/login">
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
          <ProtectedRoute allowed={['helpdesk']} fallback="/maintenance-login">
            <HelpdeskDashboard />
          </ProtectedRoute>
        }
      />

      {/* Contractor-only */}
      <Route
        path="/contractor-dashboard"
        element={
          <ProtectedRoute allowed={['contractor']} fallback="/maintenance-login">
            <ContractorDashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
