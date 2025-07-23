// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Guards a route based on authentication and role.
 *
 * - If no session → redirect to /login
 * - If session exists but role===null → show a loading spinner
 * - If session+role loaded but mismatch → redirect to /
 * - Otherwise → render children
 */
const ProtectedRoute = ({ session, role, allowedRole, children }) => {
  // Not logged in
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but no role yet → hold on
  if (session && role === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-white text-lg">Loading…</div>
      </div>
    );
  }

  // Role loaded but not allowed
  if (allowedRole && role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  // All good
  return <>{children}</>;
};

export default ProtectedRoute;


