// src/components/ProtectedRoute.js
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// REST helper: read profiles.role with explicit apikey+bearer (works even if SDK is flaky)
async function fetchProfileRole(userId) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return null;

  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? (rows[0]?.role || null) : null;
}

/**
 * Usage:
 * <ProtectedRoute allowed={['tenant']}     fallback="/login">...</ProtectedRoute>
 * <ProtectedRoute allowed={['landlord']}   fallback="/login">...</ProtectedRoute>
 * <ProtectedRoute allowed={['helpdesk']}   fallback="/maintenance-login">...</ProtectedRoute>
 * <ProtectedRoute allowed={['contractor']} fallback="/maintenance-login">...</ProtectedRoute>
 */
export default function ProtectedRoute({ allowed = [], fallback = '/login', children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'noauth' | 'forbidden'
  const location = useLocation();

  useEffect(() => {
    let alive = true;

    (async () => {
      // 1) Wait briefly for session (covers just-logged-in race)
      let { data } = await supabase.auth.getSession();
      let session = data?.session || null;
      for (let i = 0; !session && i < 12; i++) { // ~3s max
        await sleep(250);
        ({ data } = await supabase.auth.getSession());
        session = data?.session || null;
      }
      if (!alive) return;

      if (!session) {
        setStatus('noauth');
        return;
      }

      // 2) Get role from JWT first
      let role = String(session.user?.user_metadata?.role || '').toLowerCase();

      // 3) Fallback to profiles.role if JWT missing (common for helpdesk/contractor)
      if (!role) {
        role = String(await fetchProfileRole(session.user.id) || '').toLowerCase();
      }

      if (allowed.length && !allowed.includes(role)) {
        setStatus('forbidden');
        return;
      }

      setStatus('ok');
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!alive) return;
      if (!s) setStatus('noauth');
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [allowed]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-200">
        <div className="animate-pulse">Checking your access…</div>
      </div>
    );
  }

  if (status === 'noauth') {
    const roleQuery =
      allowed.includes('landlord') ? 'landlord' :
      allowed.includes('helpdesk') ? 'helpdesk' :
      allowed.includes('contractor') ? 'contractor' :
      'tenant';
    return <Navigate to={`${fallback}?role=${roleQuery}`} state={{ from: location }} replace />;
  }

  if (status === 'forbidden') {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-red-300">
        You don’t have access to this page.
      </div>
    );
  }

  return children;
}
