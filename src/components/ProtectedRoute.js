// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({
  session,
  role,
  allowedRole,
  children
}) {
  // Not logged in
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Logged in, but wrong role
  if (allowedRole && role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  // OK
  return children;
}
