import type { FC } from "hono/jsx";
import type { Config } from "../../types";

interface PageProps {
  config: Config;
  saved: boolean;
}

const Page: FC<PageProps> = ({ config, saved }) => {
  return (
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Workflow - Settings</title>
        <style>{`
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
            cursor: default;
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
          .topbar-breadcrumb {
            color: var(--text-3);
            margin: 0 8px;
            font-size: 12px;
          }

          /* Content */
          .content {
            flex: 1;
            padding: 32px;
            max-width: 640px;
          }

          .page-header {
            margin-bottom: 32px;
            animation: slide-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
          }
          .page-header h2 {
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin-bottom: 6px;
          }
          .page-header p {
            font-size: 13px;
            color: var(--text-2);
            font-weight: 300;
            line-height: 1.5;
          }

          @keyframes slide-up {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Toast */
          .toast {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            margin-bottom: 24px;
            border-radius: 6px;
            background: var(--green-soft);
            border: 1px solid rgba(92, 184, 122, 0.12);
            color: var(--green);
            font-size: 12px;
            font-weight: 500;
            animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .toast-dot {
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--green);
            flex-shrink: 0;
          }

          /* Sections */
          .section {
            background: var(--bg-content);
            border: 1px solid var(--border);
            border-radius: 10px;
            margin-bottom: 16px;
            overflow: hidden;
            animation: slide-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .section:nth-of-type(2) { animation-delay: 0.1s; }
          .section:nth-of-type(3) { animation-delay: 0.15s; }

          .section-head {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .section-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          .section-dot.jira { background: #4a90d9; }
          .section-dot.gitlab { background: #e05c43; }
          .section-head h3 {
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.01em;
          }
          .section-head span {
            font-size: 11px;
            color: var(--text-3);
            margin-left: auto;
            font-family: var(--mono);
          }

          .section-body {
            padding: 20px;
          }

          /* Fields */
          .field {
            margin-bottom: 18px;
          }
          .field:last-child { margin-bottom: 0; }

          .field-label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: var(--text-2);
            margin-bottom: 6px;
          }
          .field-label .hint {
            font-weight: 300;
            color: var(--text-3);
            font-size: 11px;
            margin-left: 4px;
          }
          .field-label a {
            color: var(--accent);
            text-decoration: none;
            font-weight: 400;
            border-bottom: 1px dashed rgba(91, 160, 232, 0.3);
            transition: border-color 0.2s;
          }
          .field-label a:hover {
            border-bottom-color: var(--accent);
          }

          .field input {
            width: 100%;
            padding: 9px 12px;
            font-size: 13px;
            font-family: var(--mono);
            color: var(--text-1);
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 6px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
          }
          .field input::placeholder {
            color: var(--text-3);
            font-weight: 400;
          }
          .field input:hover {
            border-color: var(--border-active);
          }
          .field input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-soft);
          }

          /* Save bar */
          .save-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 24px;
            animation: slide-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
          }

          .btn {
            padding: 9px 22px;
            font-size: 13px;
            font-family: var(--sans);
            font-weight: 500;
            color: #fff;
            background: var(--accent);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.15s, box-shadow 0.2s;
          }
          .btn:hover {
            background: #6aaef0;
            box-shadow: 0 2px 12px rgba(91, 160, 232, 0.25);
          }
          .btn:active {
            background: #4e95d4;
          }

          .save-note {
            font-size: 11px;
            color: var(--text-3);
            font-family: var(--mono);
          }

          /* Responsive */
          @media (max-width: 720px) {
            .sidebar { display: none; }
            .main { margin-left: 0; }
            .content { padding: 24px 20px; }
          }
        `}</style>
      </head>
      <body>
        {/* Sidebar */}
        <nav class="sidebar">
          <div class="sidebar-brand">
            <div class="sidebar-brand-icon">&#9881;</div>
            <div class="sidebar-brand-text">Workflow</div>
          </div>

          <div class="sidebar-label">General</div>
          <div class="sidebar-item active">
            <span class="sidebar-item-icon">&#9881;</span>
            Settings
          </div>
          <div class="sidebar-item">
            <span class="sidebar-item-icon">&#9776;</span>
            Logs
          </div>

          <div class="sidebar-label">Integrations</div>
          <div class="sidebar-item">
            <span class="sidebar-item-icon">&#9679;</span>
            Jira
          </div>
          <div class="sidebar-item">
            <span class="sidebar-item-icon">&#9679;</span>
            GitLab
          </div>

          <div class="sidebar-footer">v0.0.1</div>
        </nav>

        {/* Main */}
        <div class="main">
          <div class="topbar">
            <span class="topbar-title">
              <strong>Settings</strong>
            </span>
            <span class="topbar-breadcrumb">/</span>
            <span class="topbar-title">Credentials</span>
          </div>

          <div class="content">
            <div class="page-header">
              <h2>Credentials</h2>
              <p>
                Manage your service credentials. All values are stored locally
                at ~/.workflowrc and never leave your machine.
              </p>
            </div>

            {saved && (
              <div class="toast">
                <span class="toast-dot" />
                Configuration saved successfully
              </div>
            )}

            <form method="post" action="/config">
              {/* Jira Section */}
              <div class="section">
                <div class="section-head">
                  <span class="section-dot jira" />
                  <h3>Jira</h3>
                  <span>Atlassian</span>
                </div>
                <div class="section-body">
                  <div class="field">
                    <label class="field-label" for="jiraName">
                      Account
                      <span class="hint">without @datayes.com</span>
                    </label>
                    <input
                      id="jiraName"
                      name="jiraName"
                      type="text"
                      placeholder="e.g. mingyu.tan"
                      value={config.jiraName ?? ""}
                    />
                  </div>
                  <div class="field">
                    <label class="field-label" for="jiraPassword">
                      Password
                    </label>
                    <input
                      id="jiraPassword"
                      name="jiraPassword"
                      type="password"
                      placeholder="stored locally only"
                      value={config.jiraPassword ?? ""}
                    />
                  </div>
                </div>
              </div>

              {/* GitLab Section */}
              <div class="section">
                <div class="section-head">
                  <span class="section-dot gitlab" />
                  <h3>GitLab</h3>
                  <span>Personal Access Token</span>
                </div>
                <div class="section-body">
                  <div class="field">
                    <label class="field-label" for="gitlabKey">
                      Token{" "}
                      <a
                        href="http://git.datayes.com/profile/personal_access_tokens"
                        target="_blank"
                        rel="noreferrer"
                      >
                        create one here
                      </a>
                    </label>
                    <input
                      id="gitlabKey"
                      name="gitlabKey"
                      type="text"
                      placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                      value={config.gitlabKey ?? ""}
                    />
                  </div>
                </div>
              </div>

              <div class="save-bar">
                <button class="btn" type="submit">
                  Save Changes
                </button>
                <span class="save-note">saved to ~/.workflowrc</span>
              </div>
            </form>
          </div>
        </div>
      </body>
    </html>
  );
};

export const configPage = (config: Config = {}, saved = false) => (
  <Page config={config} saved={saved} />
);
