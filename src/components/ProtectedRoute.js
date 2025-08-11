// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Usage:
 * <ProtectedRoute session={session} role={role} allowedRole="helpdesk">
 *   <HelpdeskDashboard />
 * </ProtectedRoute>
 *
 * Behavior:
 * - If no session -> send to /login (tenant/landlord entry point).
 *   (Your team members enter via /team-login?role=..., which you link from MaintenanceLanding.)
 * - If session exists but role hasn't resolved yet (null/undefined) -> show loader (avoid redirect loop).
 * - If allowedRole is set and doesn't match -> send to a safe landing (/ or /maintenance-portal).
 * - Otherwise -> render children.
 */
export default function ProtectedRoute({
  session,
  role,
  allowedRole,
  children
}) {
  // 1) Not logged in at all → go to tenant/landlord login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // 2) Session is present, but role hasn't resolved yet (App.js still fetching profiles)
  // Treat both null and undefined as "loading" to be safe.
  if (allowedRole && (role === null || typeof role === 'undefined')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-white">
          <svg
            className="animate-spin h-10 w-10"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <p className="text-sm text-slate-300">Checking your access…</p>
        </div>
      </div>
    );
  }

  // 3) Logged in, but wrong role → send them to a neutral place
  // You can switch this to "/maintenance-portal" if you prefer for team users.
  if (allowedRole && role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  // 4) Authorized → render protected content
  return children;
}
