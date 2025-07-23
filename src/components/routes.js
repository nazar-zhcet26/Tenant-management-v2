// src/components/routes.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import Login from './Login';
import Signup from './Signup';
import MaintenanceReporter from './MaintenanceReporter';
import LandlordDashboard from './LandlordDashboard';
import ProtectedRoute from './ProtectedRoute';
import CheckYourEmail from './CheckYourEmail';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/check-your-email" element={<CheckYourEmail />} />

        {/* Tenant-only */}
        <Route
          path="/report"
          element={
            <ProtectedRoute allowedRole="tenant">
              <MaintenanceReporter />
            </ProtectedRoute>
          }
        />

        {/* Landlord-only */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="landlord">
              <LandlordDashboard />
            </ProtectedRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
