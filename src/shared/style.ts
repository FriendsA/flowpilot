export const globalStyle = `
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-void: #0A0A0F;
    --bg-surface: #0D1117;
    --bg-card: #111820;
    --bg-input: #0A0E14;
    --bg-hover: rgba(0, 255, 136, 0.04);
    --neon: #00FF88;
    --neon-hover: #33FFAA;
    --neon-soft: rgba(0, 255, 136, 0.08);
    --neon-glow: rgba(0, 255, 136, 0.15);
    --cyan: #00D4FF;
    --cyan-soft: rgba(0, 212, 255, 0.08);
    --cyan-glow: rgba(0, 212, 255, 0.15);
    --border: rgba(0, 255, 136, 0.06);
    --border-active: rgba(0, 255, 136, 0.15);
    --text-1: #E2E8F0;
    --text-2: #94A3B8;
    --text-3: #64748B;
    --success: #00FF88;
    --success-soft: rgba(0, 255, 136, 0.08);
    --error: #FF4444;
    --error-soft: rgba(255, 68, 68, 0.08);
    --warning: #FFB800;
    --mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace;
    --sans: 'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif;
  }

  html, body { height: 100%; }

  body {
    font-family: var(--sans);
    background: var(--bg-void);
    color: var(--text-1);
    display: flex;
    flex-direction: column;
    animation: page-in 0.3s ease both;
  }

  @keyframes page-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes neon-pulse {
    0%, 100% { box-shadow: 0 0 4px var(--neon-glow); }
    50% { box-shadow: 0 0 12px var(--neon-glow), 0 0 20px rgba(0,255,136,0.06); }
  }

  @keyframes dropdown-in {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Focus ── */
  :focus-visible {
    outline: 2px solid var(--neon);
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
    color: var(--bg-void);
    background: var(--neon);
    border-radius: 6px;
    text-decoration: none;
    transition: top 0.2s;
  }
  .skip-link:focus {
    top: 8px;
  }

  /* ── Header ── */
  .header {
    position: sticky;
    top: 0;
    z-index: 10;
    height: 52px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 24px;
    backdrop-filter: blur(12px);
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-icon {
    width: 28px; height: 28px;
    border-radius: 6px;
    background: linear-gradient(135deg, var(--neon), var(--cyan));
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 8px var(--neon-glow);
  }
  .brand-icon svg { width: 16px; height: 16px; }
  .brand-name {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-1);
  }
  .brand-version {
    font-size: 11px;
    font-family: var(--mono);
    color: var(--text-3);
    margin-left: 4px;
  }
  .header-nav {
    display: flex;
    gap: 4px;
    margin-left: 24px;
  }
  .nav-item {
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 400;
    color: var(--text-2);
    border-radius: 6px;
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
  }
  .nav-item:hover {
    color: var(--text-1);
    background: var(--bg-hover);
  }
  .nav-item.active {
    color: var(--neon);
    background: var(--neon-soft);
    font-weight: 500;
  }
  .header-settings {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px; height: 36px;
    border-radius: 6px;
    color: var(--text-3);
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
  }
  .header-settings:hover {
    color: var(--text-1);
    background: var(--bg-hover);
  }
  .header-settings.active {
    color: var(--neon);
    background: var(--neon-soft);
  }
  .header-settings svg {
    width: 18px; height: 18px;
    stroke: currentColor;
    stroke-width: 1.5;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Main area ── */
  .main {
    flex: 1;
    min-height: calc(100vh - 52px);
    display: flex;
    justify-content: center;
  }
  .content {
    width: 100%;
    max-width: 720px;
    padding: 32px 24px;
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
    .content { padding: 24px 16px; }
    .header { padding: 0 16px; }
  }
`;