import { type FC, useEffect, useState } from "hono/jsx";
import { render } from "hono/jsx/dom";
import { PageHeader, pageHeaderCss } from "../../shared/components/common";
import { initPromise, t } from "../../shared/i18n";

const EYE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 5.06A9.68 9.68 0 0 1 12 4c7 0 11 8 11 8a18.45 18.45 0 0 1-3.06 4.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

const configStyle = `${pageHeaderCss}
  .toast {
    display: none;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    margin-bottom: 24px;
    border-radius: 6px;
    background: var(--success-soft);
    border: 1px solid rgba(0,255,136,0.12);
    color: var(--neon);
    font-size: 12px;
    font-weight: 500;
  }
  .toast.visible {
    display: inline-flex;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .toast.error {
    background: rgba(255,85,85,0.08);
    border-color: rgba(255,85,85,0.2);
    color: #ff5555;
  }
  .toast.error .toast-dot {
    background: #ff5555;
  }
  .toast-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--neon);
    animation: neon-pulse 2s ease infinite;
  }

  .section {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-bottom: 16px;
    overflow: hidden;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: border-color 0.2s;
  }
  .section:nth-of-type(2) { animation-delay: 0.06s; }
	  .section:nth-of-type(3) { animation-delay: 0.12s; }
  .section:hover { border-color: var(--border-active); }

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
  .section-dot.jira { background: var(--cyan); box-shadow: 0 0 6px var(--cyan-glow); }
	  .section-dot.general { background: #a78bfa; box-shadow: 0 0 6px rgba(167,139,250,0.4); }
  .section-dot.gitlab { background: var(--neon); box-shadow: 0 0 6px var(--neon-glow); }
	  .section-dot.jenkins { background: #e67e22; box-shadow: 0 0 6px rgba(230,126,34,0.4); }
  .section-head h3 {
    font-size: 13px;
    font-weight: 600;
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

  .field-input-wrap { position: relative; }

  .field input {
    width: 100%;
    padding: 10px 12px;
    font-size: 13px;
    font-family: var(--mono);
    color: var(--text-1);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 6px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .field input.password-input { padding-right: 40px; }
  .field input::placeholder { color: var(--text-3); font-weight: 400; }
	  .field select {
	    width: 100%;
	    padding: 10px 12px;
	    font-size: 13px;
	    font-family: var(--sans);
	    color: var(--text-1);
	    background: var(--bg-input);
	    border: 1px solid var(--border);
	    border-radius: 6px;
	    outline: none;
	    appearance: none;
	    cursor: pointer;
	    transition: border-color 0.2s, box-shadow 0.2s;
	  }
	  .field select:hover { border-color: var(--border-active); }
	  .field select:focus {
	    border-color: var(--neon);
	    box-shadow: 0 0 0 2px var(--neon-soft), 0 0 8px var(--neon-glow);
	  }
  .field input:hover { border-color: var(--border-active); }
  .field input:focus {
    border-color: var(--neon);
    box-shadow: 0 0 0 2px var(--neon-soft), 0 0 8px var(--neon-glow);
  }

  .password-toggle {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-3);
    padding: 0;
    transition: color 0.15s;
  }
  .password-toggle:hover { color: var(--text-2); }
  .password-toggle svg {
    width: 18px; height: 18px;
    stroke: currentColor;
    stroke-width: 1.5;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .save-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
  }

  .btn {
    min-height: 44px;
    padding: 10px 22px;
    font-size: 13px;
    font-family: var(--sans);
    font-weight: 500;
    color: var(--bg-void);
    background: var(--neon);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.2s;
  }
  .btn:hover {
    background: var(--neon-hover);
    box-shadow: 0 0 12px var(--neon-glow), 0 2px 12px rgba(0,255,136,0.2);
  }
  .btn:active { background: #00DD77; }
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

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
	locale?: "zh-CN" | "en";
	jiraHost?: string;
	jiraName?: string;
	jiraPassword?: string;
	gitlabHost?: string;
	gitlabKey?: string;
	jenkinsHost?: string;
	jenkinsUser?: string;
	jenkinsPassword?: string;
};

const ConfigClient: FC = () => {
	const [config, setConfig] = useState<Config>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [toast, setToast] = useState<{
		show: boolean;
		type: "success" | "error";
	}>({ show: false, type: "success" });
	const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
		{},
	);

	useEffect(() => {
		fetch("/config/api/config")
			.then((r) => r.json())
			.then((data) => {
				setConfig(data);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, []);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const data = Object.fromEntries(new FormData(form));
		const localeChanged = data.locale !== (config.locale ?? "zh-CN");
		setSaving(true);
		try {
			const res = await fetch("/config/api/config", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (res.ok) {
				if (localeChanged) {
					window.location.reload();
					return;
				}
				setToast({ show: true, type: "success" });
			} else {
				setToast({ show: true, type: "error" });
			}
		} catch {
			setToast({ show: true, type: "error" });
		} finally {
			setSaving(false);
			setTimeout(
				() => setToast((prev) => ({ show: false, type: prev.type })),
				3000,
			);
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

			<PageHeader
				title={t("web.settingsTitle")}
				description={t("web.settingsDesc")}
			/>

			{toast.show && (
				<div
					class={`toast visible ${toast.type === "error" ? "error" : ""}`}
					role="status"
					aria-live="polite"
				>
					<span class="toast-dot" />
					{toast.type === "error" ? t("web.saveFailed") : t("web.savedToast")}
				</div>
			)}

			<form onSubmit={handleSubmit}>
				<div class="section">
					<div class="section-head">
						<span class="section-dot general" />
						<h3>{t("web.generalSection")}</h3>
					</div>
					<div class="section-body">
						<div class="field">
							<label class="field-label" for="locale">
								{t("web.localeLabel")}
							</label>
							<select
								id="locale"
								name="locale"
								value={config.locale ?? "zh-CN"}
								onChange={(e: Event) =>
									setConfig((prev) => ({
										...prev,
										locale: (e.target as HTMLSelectElement).value as
											| "zh-CN"
											| "en",
									}))
								}
							>
								<option value="zh-CN">中文 (zh-CN)</option>
								<option value="en">English (en)</option>
							</select>
						</div>
					</div>
				</div>

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
								onInput={(e: Event) =>
									setConfig((prev) => ({
										...prev,
										jiraHost: (e.target as HTMLInputElement).value,
									}))
								}
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
								onInput={(e: Event) =>
									setConfig((prev) => ({
										...prev,
										jiraName: (e.target as HTMLInputElement).value,
									}))
								}
							/>
						</div>
						<div class="field">
							<label class="field-label" for="jiraPassword">
								{t("web.passwordLabel")}
							</label>
							<div class="field-input-wrap">
								<input
									id="jiraPassword"
									name="jiraPassword"
									type={showPasswords.jiraPassword ? "text" : "password"}
									class="password-input"
									placeholder={t("web.placeholderPassword")}
									value={config.jiraPassword ?? ""}
									onInput={(e: Event) =>
										setConfig((prev) => ({
											...prev,
											jiraPassword: (e.target as HTMLInputElement).value,
										}))
									}
								/>
								<button
									class="password-toggle"
									type="button"
									aria-label={
										showPasswords.jiraPassword
											? "Hide password"
											: "Show password"
									}
									onClick={() =>
										setShowPasswords({
											...showPasswords,
											jiraPassword: !showPasswords.jiraPassword,
										})
									}
									dangerouslySetInnerHTML={{
										__html: showPasswords.jiraPassword ? EYE_OFF_SVG : EYE_SVG,
									}}
								/>
							</div>
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
								onInput={(e: Event) =>
									setConfig((prev) => ({
										...prev,
										gitlabHost: (e.target as HTMLInputElement).value,
									}))
								}
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
								onInput={(e: Event) =>
									setConfig((prev) => ({
										...prev,
										gitlabKey: (e.target as HTMLInputElement).value,
									}))
								}
							/>
						</div>
					</div>
				</div>

				<div class="section">
					<div class="section-head">
						<span class="section-dot jenkins" />
						<h3>{t("web.jenkinsSection")}</h3>
					</div>
					<div class="section-body">
						<div class="field">
							<label class="field-label" for="jenkinsHost">
								{t("web.hostLabel")}
								<span class="hint">{t("web.hostHintJenkins")}</span>
							</label>
							<input
								id="jenkinsHost"
								name="jenkinsHost"
								type="text"
								placeholder={t("web.placeholderJenkinsHost")}
								value={config.jenkinsHost ?? ""}
								onInput={(e: Event) =>
									setConfig((prev) => ({
										...prev,
										jenkinsHost: (e.target as HTMLInputElement).value,
									}))
								}
							/>
						</div>
						<div class="field">
							<label class="field-label" for="jenkinsUser">
								{t("web.jenkinsUserLabel")}
							</label>
							<input
								id="jenkinsUser"
								name="jenkinsUser"
								type="text"
								placeholder={t("web.placeholderJenkinsUser")}
								value={config.jenkinsUser ?? ""}
								onInput={(e: Event) =>
									setConfig((prev) => ({
										...prev,
										jenkinsUser: (e.target as HTMLInputElement).value,
									}))
								}
							/>
						</div>
						<div class="field">
							<label class="field-label" for="jenkinsPassword">
								{t("web.jenkinsPasswordLabel")}
							</label>
							<div class="field-input-wrap">
								<input
									id="jenkinsPassword"
									name="jenkinsPassword"
									type={showPasswords.jenkinsPassword ? "text" : "password"}
									class="password-input"
									placeholder={t("web.placeholderJenkinsPassword")}
									value={config.jenkinsPassword ?? ""}
									onInput={(e: Event) =>
										setConfig((prev) => ({
											...prev,
											jenkinsPassword: (e.target as HTMLInputElement).value,
										}))
									}
								/>
								<button
									class="password-toggle"
									type="button"
									aria-label={
										showPasswords.jenkinsPassword
											? "Hide password"
											: "Show password"
									}
									onClick={() =>
										setShowPasswords({
											...showPasswords,
											jenkinsPassword: !showPasswords.jenkinsPassword,
										})
									}
									dangerouslySetInnerHTML={{
										__html: showPasswords.jenkinsPassword
											? EYE_OFF_SVG
											: EYE_SVG,
									}}
								/>
							</div>
						</div>
					</div>
				</div>

				<div class="save-bar">
					<button class="btn" type="submit" disabled={saving}>
						{saving ? t("web.savingBtn") : t("web.saveBtn")}
					</button>
					<span class="save-note">{t("web.saveNote")}</span>
				</div>
			</form>
		</div>
	);
};

export const mount = async (el: HTMLElement) => {
	await initPromise;
	render(<ConfigClient />, el);
};
