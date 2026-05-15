export const globalStyle = `
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-base: #0b0f19;
    --bg-sidebar: #0e1220;
    --bg-content: #111627;
    --bg-input: #0d1120;
    --bg-hover: rgba(100, 160, 255, 0.04);
    --border: rgba(100, 160, 255, 0.07);
    --border-active: rgba(100, 180, 255, 0.2);
    --text-1: #e8ecf4;
    --text-2: #8893a7;
    --text-3: #4e5969;
    --accent: #5ba0e8;
    --accent-soft: rgba(91, 160, 232, 0.1);
    --green: #5cb87a;
    --green-soft: rgba(92, 184, 122, 0.08);
    --sidebar-w: 220px;
    --topbar-h: 56px;
    --mono: 'JetBrains Mono', monospace;
    --sans: 'Outfit', sans-serif;
  }

  html, body { height: 100%; }

  body {
    font-family: var(--sans);
    background: var(--bg-base);
    color: var(--text-1);
    display: flex;
    animation: page-in 0.5s ease both;
  }

  @keyframes page-in {
    from { opacity: 0; }
    to { opacity: 1; }
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
    font-size: 15px;
    flex-shrink: 0;
  }
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
    padding: 9px 20px;
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
    text-align: center;
    font-size: 14px;
    opacity: 0.7;
    flex-shrink: 0;
  }
  .sidebar-item.active .sidebar-item-icon { opacity: 1; }

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
    font-size: 22px;
    text-decoration: none;
    transition: background 0.15s, color 0.2s;
  }
  .topbar-settings:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }

  /* Content */
  .content {
    flex: 1;
    padding: 32px;
    max-width: 960px;
  }

  @keyframes slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Responsive */
  @media (max-width: 720px) {
    .sidebar { display: none; }
    .main { margin-left: 0; }
    .content { padding: 24px 20px; }
  }
`;
