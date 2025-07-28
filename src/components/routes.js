// src/components/routes.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import LandingPage         from './LandingPage';
import Login               from './Login';
import Signup              from './Signup';
import CheckYourEmail      from './CheckYourEmail';
import MaintenanceReporter from './MaintenanceReporter';
import LandlordDashboard   from './LandlordDashboard';
import ProtectedRoute      from './ProtectedRoute';

export default function AppRoutes({ session, role }) {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"                   element={<LandingPage />} />
      <Route path="/login"              element={<Login />} />
      <Route path="/signup"             element={<Signup />} />
      <Route path="/check-your-email"   element={<CheckYourEmail />} />

      {/* Tenant-only */}
      <Route
        path="/report"
        element={
          <ProtectedRoute session={session} role={role} allowedRole="tenant">
            <MaintenanceReporter/>
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

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
