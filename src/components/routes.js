// src/components/routes.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import Login from './Login';
import Signup from './Signup';
import MaintenanceReporter from './MaintenanceReporter';
import LandlordDashboard from './LandlordDashboard';
import ProtectedRoute from './ProtectedRoute';

const AppRoutes = ({ session, role }) => (
  <Routes>
    {/* Public routes */}
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />

    {/* Tenant-only reporting */}
    <Route
      path="/report"
      element={
        <ProtectedRoute session={session} role={role} allowedRole="tenant">
          <MaintenanceReporter />
        </ProtectedRoute>
      }
    />

    {/* Landlord-only dashboard */}
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute session={session} role={role} allowedRole="landlord">
          <LandlordDashboard />
        </ProtectedRoute>
      }
    />

    {/* Fallback to landing */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;
