// src/components/ToastProvider.js
import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const ToastCtx = createContext(null);

const toastColors = {
  amber:  { border: "#f59e0b", bg: "rgba(245,158,11,0.15)" },   // pending
  blue:   { border: "#3b82f6", bg: "rgba(59,130,246,0.15)" },   // assigned
  green:  { border: "#10b981", bg: "rgba(16,185,129,0.15)" },   // accepted
  violet: { border: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },   // review
  teal:   { border: "#14b8a6", bg: "rgba(20,184,166,0.15)" },   // completed
  red:    { border: "#ef4444", bg: "rgba(239,68,68,0.15)" },    // rejected
  gray:   { border: "#9ca3af", bg: "rgba(156,163,175,0.15)" },  // fallback
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(({ title, description, actionLabel, onAction, duration = 6000, color = "gray" }) => {
    const id = Math.random().toString(36).slice(2);
    const item = { id, title, description, actionLabel, onAction, color };
    setToasts((t) => [...t, item]);

    const timer = setTimeout(() => remove(id), duration);
    return () => { clearTimeout(timer); remove(id); };
  }, [remove]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div style={viewportStyle}>
        {toasts.map((t) => {
          const colors = toastColors[t.color] || toastColors.gray;
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              style={{
                ...toastStyle,
                background: colors.bg,
                borderColor: colors.border,
              }}
            >
              {t.title && <div style={titleStyle}>{t.title}</div>}
              {t.description && <div style={descStyle}>{t.description}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {t.actionLabel && (
                  <button
                    style={btnPrimary}
                    onClick={() => { try { t.onAction && t.onAction(); } finally { remove(t.id); } }}
                  >
                    {t.actionLabel}
                  </button>
                )}
                <button style={btnGhost} aria-label="Dismiss" onClick={() => remove(t.id)}>Dismiss</button>
              </div>
              <button style={xStyle} aria-label="Close" onClick={() => remove(t.id)}>×</button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/* Inline styles */
const viewportStyle = {
  position: "fixed",
  right: "16px",
  bottom: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  zIndex: 9999,
};

const toastStyle = {
  position: "relative",
  width: "360px",
  maxWidth: "90vw",
  color: "#fff",
  padding: "12px 44px 12px 12px",
  borderRadius: "12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
  border: "1px solid rgba(255,255,255,0.2)",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  backdropFilter: "blur(6px)",
};

const titleStyle = { fontWeight: 700, marginBottom: 6, fontSize: 15, lineHeight: "18px" };
const descStyle  = { fontSize: 14, lineHeight: "18px", opacity: 0.95 };
const btnPrimary = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  cursor: "pointer",
};
const btnGhost   = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "#ddd",
  cursor: "pointer",
};
const xStyle     = {
  position: "absolute",
  right: 8,
  top: 6,
  border: "none",
  background: "transparent",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  color: "#ddd",
};
