import { neonbladeCss } from "./components/neonblade/styles";

export const globalStyle = `
@layer base {
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-void: #0A0A0F;
    --bg-card: #111820;
    --bg-input: #0A0E14;
    --neon: #00f3ff;
    --neon-glow: rgba(0, 243, 255, 0.15);
    --cyan: #00D4FF;
    --border: rgba(0, 243, 255, 0.06);
    --text-1: #E2E8F0;
    --text-2: #94A3B8;
    --text-3: #64748B;
    --success-soft: rgba(0, 243, 255, 0.08);
    --error: #FF4444;
    --mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace;
    --sans: 'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif;
    --sidebar-width: 240px;
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
    50% { box-shadow: 0 0 12px var(--neon-glow), 0 0 20px rgba(0,243,255,0.06); }
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

  /* ── Sidebar (drawer) ── */
  .sidebar {
    position: fixed;
    left: 12px;
    top: 12px;
    bottom: 12px;
    width: var(--sidebar-width);
    display: flex;
    flex-direction: column;
    transform: translateX(0);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 101;
  }
  .sidebar.collapsed {
    transform: translateX(calc(-100% - 16px));
    pointer-events: none;
  }
  .sidebar-card { flex: 1; min-height: 0; height: 100%; }
  .sidebar-card .bbc-inner { padding: 0 !important; height: 100%; }

  /* Floating trigger tab to open/close the drawer */
  .sidebar-trigger {
    position: fixed !important;
    left: 0;
    top: 50%;
    transform: translateY(-50%) !important;
    z-index: 102;
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .sidebar-trigger button {
    width: 26px;
    height: 48px;
    padding: 0 !important;
    min-height: 0 !important;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sidebar-trigger .ccb-clip-all,
  .sidebar-trigger .ccb-frame {
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%) !important;
  }
  .sidebar-trigger svg {
    width: 14px;
    height: 14px;
    transition: transform 0.3s;
  }
  /* When drawer open: move tab to the drawer's right edge and flip the icon */
  .sidebar:not(.collapsed) ~ .sidebar-trigger {
    left: calc(var(--sidebar-width) + 12px);
  }
  .sidebar:not(.collapsed) ~ .sidebar-trigger svg {
    transform: rotate(180deg);
  }

  /* Backdrop: click to close */
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 100;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
  }
  .sidebar:not(.collapsed) ~ .sidebar-backdrop {
    opacity: 1;
    pointer-events: auto;
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
    width: 38px; height: 38px;
    min-width: 38px;
    padding: 1.5px;
    background: linear-gradient(135deg, var(--neon), var(--cyan));
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 14px color-mix(in srgb, var(--neon) 35%, transparent);
    transition: box-shadow 0.3s, filter 0.3s;
  }
  .brand-icon:hover {
    box-shadow: 0 0 20px color-mix(in srgb, var(--neon) 55%, transparent);
    filter: saturate(1.2);
  }
  .brand-icon-inner {
    width: 100%; height: 100%;
    background: var(--bg-void);
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%);
    display: flex; align-items: center; justify-content: center;
    color: var(--neon);
  }
  .brand-icon-inner svg { width: 18px; height: 18px; stroke: currentColor; }
  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    opacity: 1;
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

  .sidebar-nav {
    flex: 1;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }
  .nav-item {
    display: block;
    padding: 1px;
    background: var(--border);
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
    text-decoration: none;
    transition: background 0.2s;
  }
  .nav-item-inner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-2);
    background: var(--bg-card);
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%);
    transition: color 0.2s, background 0.2s;
  }
  .nav-item:hover { background: color-mix(in srgb, var(--item-accent, var(--neon)) 55%, transparent); }
  .nav-item:hover .nav-item-inner {
    color: var(--item-accent, var(--neon));
    background: color-mix(in srgb, var(--item-accent, var(--neon)) 10%, var(--bg-card));
  }
  .nav-item.active { background: var(--item-accent, var(--neon)); }
  .nav-item.active .nav-item-inner {
    color: var(--item-accent, var(--neon));
    font-weight: 600;
    background: color-mix(in srgb, var(--item-accent, var(--neon)) 14%, var(--bg-card));
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
  }

  .sidebar-footer {
    padding: 12px 8px 16px;
    border-top: 1px solid var(--border);
  }
  .footer-settings {
    display: block;
    padding: 1px;
    background: var(--border);
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
    text-decoration: none;
    transition: background 0.2s;
  }
  .footer-settings-inner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-3);
    background: var(--bg-card);
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%);
    transition: color 0.2s, background 0.2s;
  }
  .footer-settings:hover { background: color-mix(in srgb, var(--item-accent, var(--neon)) 55%, transparent); }
  .footer-settings:hover .footer-settings-inner {
    color: var(--item-accent, var(--neon));
    background: color-mix(in srgb, var(--item-accent, var(--neon)) 10%, var(--bg-card));
  }
  .footer-settings.active { background: var(--item-accent, var(--neon)); }
  .footer-settings.active .footer-settings-inner {
    color: var(--item-accent, var(--neon));
    font-weight: 600;
    background: color-mix(in srgb, var(--item-accent, var(--neon)) 14%, var(--bg-card));
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
  }

  /* ── Main area ── */
  .main-wrapper {
    flex: 1;
    min-height: 100vh;
    padding: 0 24px;
  }
  .main {
    min-height: 100vh;
    padding: 32px 24px;
    margin: 0 auto;
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
    .main { padding: 24px 20px; }
  }
}

/* ── NeonBlade UI components (un-layered, highest cascade priority) ── */
${neonbladeCss}
`;
