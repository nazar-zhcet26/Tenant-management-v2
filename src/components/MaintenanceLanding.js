import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MaintenanceLanding() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white flex flex-col items-center justify-center p-6">
            <h1 className="text-4xl font-bold mb-12">Welcome to Maintenance Portal</h1>
            <div className="flex flex-col sm:flex-row gap-8">
                <button// src/components/MaintenanceLanding.js
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function MaintenanceLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Top bar */}
      <header className="w-full border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
            <span className="font-semibold tracking-wide">PropertyCare</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-slate-300 hover:text-white transition">Main App</Link>
            <Link to="/login" className="text-slate-300 hover:text-white transition">Tenant/Landlord Login</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-4 py-16">
        <section className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
              Maintenance Team Portal
            </h1>
            <p className="mt-4 text-slate-300">
              Central access for internal teams. Choose your role to continue.
              Helpdesk manages incoming tickets and dispatch. Contractors view assigned jobs and update status.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/maintenance-login?role=helpdesk')}
                className="group w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-medium shadow-lg shadow-blue-900/30 transition"
              >
                Helpdesk Login
              </button>

              <button
                onClick={() => navigate('/maintenance-login?role=contractor')}
                className="group w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-medium shadow-lg shadow-emerald-900/30 transition"
              >
                Contractor Login
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Don’t have credentials? Contact your administrator.
            </p>
          </div>

          {/* Info card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
            <h2 className="text-lg font-semibold">What’s inside</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-400" />
                <div>
                  <span className="font-medium text-white">Helpdesk Dashboard</span>
                  <p className="text-slate-400">
                    Intake & triage new tenant reports, prioritize by SLA, and dispatch to contractors.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <div>
                  <span className="font-medium text-white">Contractor Dashboard</span>
                  <p className="text-slate-400">
                    View assigned jobs, update progress, upload photos, and mark work complete.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-purple-400" />
                <div>
                  <span className="font-medium text-white">Secure Role Access</span>
                  <p className="text-slate-400">
                    Only pre‑created accounts with the correct role can enter these dashboards.
                  </p>
                </div>
              </li>
            </ul>

            <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Status: Operational
              </span>
              <span className="opacity-40">•</span>
              <span>Build: MVP channel</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-10 border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-400 flex items-center justify-between">
          <span>© {new Date().getFullYear()} PropertyCare</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-white transition">Main App</Link>
            <Link to="/maintenance-login?role=helpdesk" className="hover:text-white transition">Helpdesk</Link>
            <Link to="/maintenance-login?role=contractor" className="hover:text-white transition">Contractor</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

                    onClick={() => navigate('/team-login?role=helpdesk')}
                    className="bg-blue-600 hover:bg-blue-700 px-10 py-4 rounded-lg text-xl font-semibold shadow-lg transition"
                >
                    Helpdesk Login
                </button>
                <button
                    onClick={() => navigate('/team-login?role=contractor')}
                    className="bg-green-600 hover:bg-green-700 px-10 py-4 rounded-lg text-xl font-semibold shadow-lg transition"
                >
                    Contractor Login
                </button>
            </div>
        </div>
    );
}


