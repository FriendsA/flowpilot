export const globalStyle = `
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-base: #0F172A;
    --bg-sidebar: #111827;
    --bg-content: #131A2B;
    --bg-input: #0F1628;
    --bg-hover: rgba(100, 160, 255, 0.04);
    --border: rgba(100, 160, 255, 0.07);
    --border-active: rgba(100, 180, 255, 0.2);
    --text-1: #E2E8F0;
    --text-2: #94A3B8;
    --text-3: #64748B;
    --accent: #5B9CF0;
    --accent-hover: #6AAEF0;
    --accent-soft: rgba(91, 156, 240, 0.1);
    --success: #22C55E;
    --success-soft: rgba(34, 197, 94, 0.08);
    --error: #EF4444;
    --error-soft: rgba(239, 68, 68, 0.08);
    --warning: #F59E0B;
    --sidebar-w: 220px;
    --topbar-h: 56px;
    --mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Source Code Pro', Menlo, Consolas, monospace;
    --sans: 'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif;
  }

  html, body { height: 100%; }

  body {
    font-family: var(--sans);
    background: var(--bg-base);
    color: var(--text-1);
    display: flex;
    animation: page-in 0.3s ease both;
  }

  @keyframes page-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Focus ── */
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  :focus:not(:focus-visible) {
    outline: none;
  }

  /* ── Skip link ── */
  .skip-link {
    position: absolute;
    top: -100%;
    left: 8px;
    z-index: 9999;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--bg-base);
    background: var(--accent);
    border-radius: 6px;
    text-decoration: none;
    transition: top 0.2s;
  }
  .skip-link:focus {
    top: 8px;
  }

  /* ── Sidebar ── */
  .sidebar {
    width: var(--sidebar-w);
    height: 100vh;
    position: fixed;
    left: 0; top: 0;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 20px 0;
    z-index: 10;
  }
  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 20px 24px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }
  .sidebar-brand-icon {
    width: 32px; height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #2d5aa0, #5b3dbf);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .sidebar-brand-icon svg { width: 16px; height: 16px; }
  .sidebar-brand-text {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .sidebar-label {
    padding: 16px 20px 6px;
    font-size: 10px;
    font-weight: 500;
    font-family: var(--mono);
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    margin: 1px 8px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 400;
    color: var(--text-2);
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .sidebar-item:hover {
    background: var(--bg-hover);
    color: var(--text-1);
  }
  .sidebar-item.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 500;
  }
  .sidebar-item-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
  .sidebar-item-icon svg {
    width: 18px; height: 18px;
    stroke: currentColor;
    stroke-width: 1.5;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .sidebar-item.active .sidebar-item-icon svg { stroke-width: 2; }

  .sidebar-footer {
    margin-top: auto;
    padding: 16px 20px 0;
    border-top: 1px solid var(--border);
    font-size: 11px;
    font-family: var(--mono);
    color: var(--text-3);
  }

  /* ── Main area ── */
  .main {
    margin-left: var(--sidebar-w);
    flex: 1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Top bar */
  .topbar {
    height: var(--topbar-h);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 32px;
    background: var(--bg-content);
    position: sticky;
    top: 0;
    z-index: 5;
  }
  .topbar-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
  }
  .topbar-title strong {
    color: var(--text-1);
    font-weight: 600;
  }
  .topbar-settings {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px; height: 42px;
    border-radius: 8px;
    color: var(--text-2);
    text-decoration: none;
    transition: background 0.15s, color 0.2s;
  }
  .topbar-settings:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .topbar-settings svg {
    width: 20px; height: 20px;
    stroke: currentColor;
    stroke-width: 1.5;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Content */
  .content {
    flex: 1;
    padding: 32px;
    max-width: 960px;
  }

  @keyframes slide-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Reduced motion ── */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* Responsive */
  @media (max-width: 720px) {
    .sidebar { display: none; }
    .main { margin-left: 0; }
    .content { padding: 24px 20px; }
  }
`;