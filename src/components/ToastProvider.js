// src/components/ToastProvider.js
import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";

// Simple toast store
const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const remove = useCallback((id) => {
        setToasts((t) => t.filter((x) => x.id !== id));
    }, []);

    const toast = useCallback(({ title, description, actionLabel, onAction, duration = 6000 }) => {
        const id = Math.random().toString(36).slice(2);
        const item = { id, title, description, actionLabel, onAction };
        setToasts((t) => [...t, item]);

        // auto-dismiss
        const timer = setTimeout(() => remove(id), duration);
        return () => {
            clearTimeout(timer);
            remove(id);
        };
    }, [remove]);

    const value = useMemo(() => ({ toast }), [toast]);

    return (
        <ToastCtx.Provider value={value}>
            {children}
            {/* Toast viewport */}
            <div style={viewportStyle}>
                {toasts.map((t) => (
                    <div key={t.id} style={toastStyle} role="status" aria-live="polite">
                        {t.title && <div style={titleStyle}>{t.title}</div>}
                        {t.description && <div style={descStyle}>{t.description}</div>}
                        {t.actionLabel && (
                            <button
                                style={btnStyle}
                                onClick={() => {
                                    try { t.onAction && t.onAction(); } finally { remove(t.id); }
                                }}
                            >
                                {t.actionLabel}
                            </button>
                        )}
                        <button style={xStyle} aria-label="Dismiss" onClick={() => remove(t.id)}>×</button>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastCtx);
    if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
    return ctx;
}

/* Inline styles (kept tiny + neutral) */
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
    width: "320px",
    maxWidth: "90vw",
    background: "white",
    color: "#111",
    padding: "12px 40px 12px 12px",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    border: "1px solid rgba(0,0,0,0.06)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
};

const titleStyle = { fontWeight: 600, marginBottom: 6, fontSize: 15, lineHeight: "18px" };
const descStyle = { fontSize: 14, lineHeight: "18px", opacity: 0.9 };
const btnStyle = {
    marginTop: 10,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    cursor: "pointer",
};
const xStyle = {
    position: "absolute",
    right: 8,
    top: 6,
    border: "none",
    background: "transparent",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
    color: "#666",
};

