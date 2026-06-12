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
    --sidebar-width: 240px;
    --sidebar-collapsed-width: 64px;
  }

  html, body { height: 100%; }

  body {
    font-family: var(--sans);
    background: var(--bg-void);
    color: var(--text-1);
    display: flex;
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

  @keyframes slide-right {
    from { opacity: 0; transform: translateX(-12px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes neon-pulse {
    0%, 100% { box-shadow: 0 0 4px var(--neon-glow); }
    50% { box-shadow: 0 0 12px var(--neon-glow), 0 0 20px rgba(0,255,136,0.06); }
  }

  @keyframes dropdown-in {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes icon-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
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

  /* ── Sidebar ── */
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 100;
    overflow: hidden;
  }
  .sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
  }

  .sidebar-header {
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 64px;
  }
  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }
  .brand-icon {
    width: 32px; height: 32px;
    min-width: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--neon), var(--cyan));
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 12px var(--neon-glow);
    transition: box-shadow 0.3s;
  }
  .brand-icon:hover {
    box-shadow: 0 0 20px var(--neon-glow), 0 0 32px rgba(0,255,136,0.2);
  }
  .brand-icon svg { width: 18px; height: 18px; }
  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    opacity: 1;
    transition: opacity 0.2s;
  }
  .sidebar.collapsed .brand-text {
    opacity: 0;
    width: 0;
  }
  .brand-name {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-1);
    white-space: nowrap;
  }
  .brand-version {
    font-size: 11px;
    font-family: var(--mono);
    color: var(--text-3);
    white-space: nowrap;
  }

  .sidebar-toggle {
    width: 28px; height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s, transform 0.3s;
  }
  .sidebar-toggle:hover {
    background: var(--bg-hover);
    color: var(--text-1);
  }
  .sidebar-toggle svg {
    width: 16px; height: 16px;
    transition: transform 0.3s;
  }
  .sidebar.collapsed .sidebar-toggle svg {
    transform: rotate(180deg);
  }

  .sidebar-nav {
    flex: 1;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 450;
    color: var(--text-2);
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }
  .nav-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%) scaleY(0);
    width: 3px;
    height: 20px;
    background: var(--neon);
    border-radius: 0 4px 4px 0;
    transition: transform 0.2s;
  }
  .nav-item:hover {
    color: var(--text-1);
    background: var(--bg-hover);
    transform: translateX(2px);
  }
  .nav-item.active {
    color: var(--neon);
    background: var(--neon-soft);
    font-weight: 500;
  }
  .nav-item.active::before {
    transform: translateY(-50%) scaleY(1);
  }
  .nav-item-icon {
    width: 20px; height: 20px;
    min-width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  }
  .nav-item:hover .nav-item-icon {
    transform: scale(1.1);
  }
  .nav-item-icon svg {
    width: 20px; height: 20px;
    stroke: currentColor;
    transition: transform 0.2s;
  }
  .nav-item-label {
    flex: 1;
    white-space: nowrap;
    opacity: 1;
    transition: opacity 0.2s;
  }
  .sidebar.collapsed .nav-item-label {
    opacity: 0;
  }
  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 10px;
  }

  .sidebar-footer {
    padding: 12px 8px 16px;
    border-top: 1px solid var(--border);
  }
  .footer-settings {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-3);
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.2s;
  }
  .footer-settings:hover {
    color: var(--text-1);
    background: var(--bg-hover);
  }
  .footer-settings.active {
    color: var(--neon);
    background: var(--neon-soft);
  }
  .footer-settings-icon {
    width: 20px; height: 20px;
    min-width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .footer-settings-icon svg {
    width: 18px; height: 18px;
    stroke: currentColor;
    stroke-width: 1.5;
    fill: none;
  }
  .footer-settings-label {
    flex: 1;
    opacity: 1;
    transition: opacity 0.2s;
  }
  .sidebar.collapsed .footer-settings-label {
    opacity: 0;
  }
  .sidebar.collapsed .footer-settings {
    justify-content: center;
    padding: 10px;
  }

  /* ── Main area ── */
  .main-wrapper {
    flex: 1;
    margin-left: var(--sidebar-width);
    transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    min-height: 100vh;
  }
  .sidebar.collapsed + .main-wrapper {
    margin-left: var(--sidebar-collapsed-width);
  }
  .main {
    min-height: 100vh;
    padding: 32px 48px;
    animation: slide-right 0.4s ease both;
    max-width: 1200px;
  }
  .content {
    width: 100%;
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
  @media (max-width: 1024px) {
    .main { padding: 24px 32px; }
  }

  @media (max-width: 768px) {
    .sidebar {
      width: var(--sidebar-collapsed-width);
    }
    .sidebar .brand-text,
    .sidebar .nav-item-label,
    .sidebar .footer-settings-label {
      opacity: 0;
    }
    .main-wrapper {
      margin-left: var(--sidebar-collapsed-width);
    }
    .main { padding: 24px 20px; }
  }
`;
