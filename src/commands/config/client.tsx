import i18next from "i18next";
import { type FC, useEffect, useState } from "hono/jsx";
import { render } from "hono/jsx/dom";

// Hydrate i18n from server-inlined data
if (typeof window !== "undefined" && window.__I18N_LOCALE__ && window.__I18N_RESOURCES__) {
	i18next.init({
		lng: window.__I18N_LOCALE__,
		fallbackLng: "zh-CN",
		resources: window.__I18N_RESOURCES__,
		interpolation: { escapeValue: false },
	});
}
const t = i18next.t;

declare global {
	interface Window {
		__I18N_LOCALE__: string;
		__I18N_RESOURCES__: Record<string, { translation: Record<string, unknown> }>;
	}
}

const configStyle = `
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

  .toast {
    display: none;
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
  }
  .toast.visible {
    display: inline-flex;
    animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .toast-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--green);
    flex-shrink: 0;
  }

  .section {
    background: var(--bg-content);
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-bottom: 16px;
    overflow: hidden;
    animation: slide-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .section:nth-of-type(2) { animation-delay: 0.1s; }

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

  .section-body { padding: 20px; }

  .field { margin-bottom: 18px; }
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
  .field input:hover { border-color: var(--border-active); }
  .field input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }

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
  .btn:active { background: #4e95d4; }

  .save-note {
    font-size: 11px;
    color: var(--text-3);
    font-family: var(--mono);
  }

  .loading {
    color: var(--text-3);
    font-size: 13px;
  }
`;

type Config = {
	jiraHost?: string;
	jiraName?: string;
	jiraPassword?: string;
	gitlabHost?: string;
	gitlabKey?: string;
};

const ConfigClient: FC = () => {
	const [config, setConfig] = useState<Config>({});
	const [loading, setLoading] = useState(true);
	const [toast, setToast] = useState(false);

	useEffect(() => {
		fetch("/config/api/config")
			.then((r) => r.json())
			.then((data) => {
				setConfig(data);
				setLoading(false);
			});
	}, []);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const data = Object.fromEntries(new FormData(form));
		const res = await fetch("/config/api/config", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});
		if (res.ok) {
			setToast(true);
			setTimeout(() => setToast(false), 2500);
		}
	};

	if (loading) {
		return (
			<div>
				<style>{configStyle}</style>
				<div class="loading">{t("web.loading")}</div>
			</div>
		);
	}

	return (
		<div>
			<style>{configStyle}</style>

			<div class="page-header">
				<h2>{t("web.settingsTitle")}</h2>
				<p>{t("web.settingsDesc")}</p>
			</div>

			{toast && (
				<div class="toast visible">
					<span class="toast-dot" />
					{t("web.savedToast")}
				</div>
			)}

			<form onSubmit={handleSubmit}>
				<div class="section">
					<div class="section-head">
						<span class="section-dot jira" />
						<h3>{t("web.jiraSection")}</h3>
					</div>
					<div class="section-body">
						<div class="field">
							<label class="field-label" for="jiraHost">
								{t("web.hostLabel")}
								<span class="hint">{t("web.hostHintJira")}</span>
							</label>
							<input
								id="jiraHost"
								name="jiraHost"
								type="text"
								placeholder={t("web.placeholderJiraHost")}
								value={config.jiraHost ?? ""}
							/>
						</div>
						<div class="field">
							<label class="field-label" for="jiraName">
								{t("web.accountLabel")}
							</label>
							<input
								id="jiraName"
								name="jiraName"
								type="text"
								placeholder={t("web.placeholderUsername")}
								value={config.jiraName ?? ""}
							/>
						</div>
						<div class="field">
							<label class="field-label" for="jiraPassword">
								{t("web.passwordLabel")}
							</label>
							<input
								id="jiraPassword"
								name="jiraPassword"
								type="password"
								placeholder={t("web.placeholderPassword")}
								value={config.jiraPassword ?? ""}
							/>
						</div>
					</div>
				</div>

				<div class="section">
					<div class="section-head">
						<span class="section-dot gitlab" />
						<h3>{t("web.gitlabSection")}</h3>
					</div>
					<div class="section-body">
						<div class="field">
							<label class="field-label" for="gitlabHost">
								{t("web.hostLabel")}
								<span class="hint">{t("web.hostHintGitlab")}</span>
							</label>
							<input
								id="gitlabHost"
								name="gitlabHost"
								type="text"
								placeholder={t("web.placeholderGitlabHost")}
								value={config.gitlabHost ?? ""}
							/>
						</div>
						<div class="field">
							<label class="field-label" for="gitlabKey">
								{t("web.tokenLabel")}
							</label>
							<input
								id="gitlabKey"
								name="gitlabKey"
								type="text"
								placeholder={t("web.placeholderToken")}
								value={config.gitlabKey ?? ""}
							/>
						</div>
					</div>
				</div>

				<div class="save-bar">
					<button class="btn" type="submit">
						{t("web.saveBtn")}
					</button>
					<span class="save-note">{t("web.saveNote")}</span>
				</div>
			</form>
		</div>
	);
};

export const mount = (el: HTMLElement) => {
	render(<ConfigClient />, el);
};