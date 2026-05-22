// Shared common CSS for spinner, loading-row, result-card, action-btn, copy-btn
// Used by release/end/mr Web UI pages

export const commonCss = `
/* ── Spinner ── */
.spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--neon);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  color: var(--text-3);
  font-size: 13px;
  margin-bottom: 16px;
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ── Result card ── */
.result-card {
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid rgba(0,212,255,0.08);
  border-radius: 8px;
  margin-bottom: 16px;
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.result-success {
  border-color: rgba(0,255,136,0.12);
}
.result-error {
  border-color: rgba(255,68,68,0.12);
}
.result-label {
  font-size: 11px;
  color: var(--text-3);
  margin-bottom: 4px;
}
.result-key {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--neon);
  text-decoration: none;
  border-bottom: 1px dashed rgba(0,255,136,0.3);
  transition: border-color 0.2s;
}
.result-key:hover { border-bottom-color: var(--neon); }
.result-text {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
}
.result-text.success { color: var(--neon); }
.result-text.error { color: var(--error); }
.result-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
  font-weight: 500;
  background: var(--neon-soft);
  color: var(--neon);
}

/* ── Action button ── */
.action-btn {
  width: 100%;
  min-height: 44px;
  padding: 10px 20px;
  font-size: 13px;
  font-family: var(--sans);
  font-weight: 500;
  color: var(--bg-void);
  background: var(--neon);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.2s;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}
.action-btn:hover { background: var(--neon-hover); box-shadow: 0 0 12px var(--neon-glow), 0 2px 12px rgba(0,255,136,0.2); }
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.action-btn.secondary {
  color: var(--text-3);
  background: transparent;
  border: 1px solid var(--border);
}
.action-btn.secondary:hover { border-color: var(--text-2); color: var(--text-2); }
.action-btn.rerun {
  color: var(--text-2);
  background: var(--bg-card);
  border: 1px solid var(--border);
  margin-top: 24px;
}
.action-btn.rerun:hover { border-color: var(--neon); color: var(--neon); }

/* ── Copy button ── */
.copy-btn {
  padding: 8px 12px;
  font-size: 11px;
  font-family: var(--sans);
  font-weight: 500;
  color: var(--bg-void);
  background: var(--cyan);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.copy-btn:hover { background: #33e0ff; }
.copy-btn.copied { background: var(--neon); }
`;