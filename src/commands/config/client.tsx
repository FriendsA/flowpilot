import { type FC, useEffect, useRef, useState } from "hono/jsx";
import { render } from "hono/jsx/dom";
import {
	fieldLabel,
	hint,
	PageHeader,
	pageHeaderCss,
	sectionTitle,
} from "../../shared/components/common";
import { CornerCutButton } from "../../shared/components/neonblade/corner-cut-button";
import { GlitchText } from "../../shared/components/neonblade/glitch-text";
import { NeonGlow } from "../../shared/components/neonblade/neon-glow";
import { NeonGlowCornerCutCard } from "../../shared/components/neonblade/neon-glow-corner-cut-card";
import { NeonInput } from "../../shared/components/neonblade/neon-input";
import { NeonSelect } from "../../shared/components/neonblade/neon-select";
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
    border: 1px solid rgba(0,243,255,0.12);
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

  .config-card { margin-bottom: 16px; }
  .config-card:last-child { margin-bottom: 0; }
  .config-card, .config-card .ngcc-card { height: auto; }

  .field { margin-bottom: 18px; }
  .field:last-child { margin-bottom: 0; }

  .field-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
    margin-bottom: 6px;
  }

  .field-input-wrap { position: relative; }

  .passwd-input { padding-right: 40px; }

  .password-toggle {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 30px; height: 30px;
    padding: 0 !important;
    line-height: 0;
  }
  .password-toggle button {
    padding: 0 !important;
    min-height: 0 !important;
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
  }
  .password-toggle .ccb-clip-all { border-radius: 6px; }
  .password-toggle:hover { color: #00f3ff; }
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

const LOCALE_ITEMS = [
	{ name: "中文 (zh-CN)", value: "zh-CN" as const },
	{ name: "English (en)", value: "en" as const },
];

const ConfigClient: FC = () => {
	const [config, setConfig] = useState<Config>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
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
				title={
					<GlitchText
						neon
						intensity="heavy"
						neonFlicker
						mode="active"
						colorA="#ff00ff"
						colorB="#00f3ff"
						glowColor="#ff00ff"
						speed="slow"
						style="color:#ff00ff"
					>
						{t("web.settingsTitle")}
					</GlitchText>
				}
				description={
					<NeonGlow colors="#00f3ff" glowIntensity="subtle">
						{t("web.settingsDesc")}
					</NeonGlow>
				}
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

			<form ref={formRef} onSubmit={handleSubmit}>
				<NeonGlowCornerCutCard
					className="config-card"
					title={sectionTitle("#a78bfa", t("web.generalSection"))}
					colorA="#a78bfa"
					size="sm"
					hoverEffect="glow-only"
				>
					<div class="field">
						<label class="field-label" for="locale">
							{fieldLabel("#a78bfa", t("web.localeLabel"))}
						</label>
						<input
							type="hidden"
							name="locale"
							value={config.locale ?? "zh-CN"}
						/>
						<NeonSelect
							id="locale"
							color="#a78bfa"
							size="md"
							searchable={false}
							placeholder={t("web.localeLabel")}
							items={LOCALE_ITEMS}
							value={LOCALE_ITEMS.find(
								(i) => i.value === (config.locale ?? "zh-CN"),
							)}
							isEqual={(a, b) => a.value === b.value}
							onSelect={(item) =>
								setConfig((prev) => ({ ...prev, locale: item.value }))
							}
						/>
					</div>
				</NeonGlowCornerCutCard>

				<NeonGlowCornerCutCard
					className="config-card"
					title={sectionTitle("#4d8cff", t("web.jiraSection"))}
					colorA="#4d8cff"
					size="sm"
					hoverEffect="glow-only"
				>
					<div class="field">
						<label class="field-label" for="jiraHost">
							{fieldLabel("#4d8cff", t("web.hostLabel"))}
							{hint("#4d8cff", t("web.hostHintJira"))}
						</label>
						<NeonInput
							id="jiraHost"
							name="jiraHost"
							color="#4d8cff"
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
							{fieldLabel("#4d8cff", t("web.accountLabel"))}
						</label>
						<NeonInput
							id="jiraName"
							name="jiraName"
							color="#4d8cff"
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
							{fieldLabel("#4d8cff", t("web.passwordLabel"))}
						</label>
						<div class="field-input-wrap">
							<NeonInput
								id="jiraPassword"
								name="jiraPassword"
								color="#4d8cff"
								type={showPasswords.jiraPassword ? "text" : "password"}
								inputClassName="passwd-input"
								placeholder={t("web.placeholderPassword")}
								value={config.jiraPassword ?? ""}
								onInput={(e: Event) =>
									setConfig((prev) => ({
										...prev,
										jiraPassword: (e.target as HTMLInputElement).value,
									}))
								}
							/>
							<CornerCutButton
								color="cyan"
								size="xs"
								variant="ghost"
								corner="all"
								hoverEffect="glow"
								className="password-toggle"
								onClick={() =>
									setShowPasswords({
										...showPasswords,
										jiraPassword: !showPasswords.jiraPassword,
									})
								}
							>
								<span
									dangerouslySetInnerHTML={{
										__html: showPasswords.jiraPassword ? EYE_OFF_SVG : EYE_SVG,
									}}
								/>
							</CornerCutButton>
						</div>
					</div>
				</NeonGlowCornerCutCard>

				<NeonGlowCornerCutCard
					className="config-card"
					title={sectionTitle("#00f3ff", t("web.gitlabSection"))}
					colorA="#00f3ff"
					size="sm"
					hoverEffect="glow-only"
				>
					<div class="field">
						<label class="field-label" for="gitlabHost">
							{fieldLabel("#00f3ff", t("web.hostLabel"))}
							{hint("#00f3ff", t("web.hostHintGitlab"))}
						</label>
						<NeonInput
							id="gitlabHost"
							name="gitlabHost"
							color="#00f3ff"
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
							{fieldLabel("#00f3ff", t("web.tokenLabel"))}
						</label>
						<NeonInput
							id="gitlabKey"
							name="gitlabKey"
							color="#00f3ff"
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
				</NeonGlowCornerCutCard>

				<NeonGlowCornerCutCard
					className="config-card"
					title={sectionTitle("#e67e22", t("web.jenkinsSection"))}
					colorA="#e67e22"
					size="sm"
					hoverEffect="glow-only"
				>
					<div class="field">
						<label class="field-label" for="jenkinsHost">
							{fieldLabel("#e67e22", t("web.hostLabel"))}
							{hint("#e67e22", t("web.hostHintJenkins"))}
						</label>
						<NeonInput
							id="jenkinsHost"
							name="jenkinsHost"
							color="#e67e22"
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
							{fieldLabel("#e67e22", t("web.jenkinsUserLabel"))}
						</label>
						<NeonInput
							id="jenkinsUser"
							name="jenkinsUser"
							color="#e67e22"
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
							{fieldLabel("#e67e22", t("web.jenkinsPasswordLabel"))}
						</label>
						<div class="field-input-wrap">
							<NeonInput
								id="jenkinsPassword"
								name="jenkinsPassword"
								color="#e67e22"
								type={showPasswords.jenkinsPassword ? "text" : "password"}
								inputClassName="passwd-input"
								placeholder={t("web.placeholderJenkinsPassword")}
								value={config.jenkinsPassword ?? ""}
								onInput={(e: Event) =>
									setConfig((prev) => ({
										...prev,
										jenkinsPassword: (e.target as HTMLInputElement).value,
									}))
								}
							/>
							<CornerCutButton
								color="cyan"
								size="xs"
								variant="ghost"
								corner="all"
								hoverEffect="glow"
								className="password-toggle"
								onClick={() =>
									setShowPasswords({
										...showPasswords,
										jenkinsPassword: !showPasswords.jenkinsPassword,
									})
								}
							>
								<span
									dangerouslySetInnerHTML={{
										__html: showPasswords.jenkinsPassword
											? EYE_OFF_SVG
											: EYE_SVG,
									}}
								/>
							</CornerCutButton>
						</div>
					</div>
				</NeonGlowCornerCutCard>

				<div class="save-bar">
					<CornerCutButton
						color="cyan"
						variant="solid"
						disabled={saving}
						onClick={() => formRef.current?.requestSubmit()}
					>
						{saving ? t("web.savingBtn") : t("web.saveBtn")}
					</CornerCutButton>
					<span class="save-note">
						<NeonGlow colors="#00f3ff" glowIntensity="subtle">
							{t("web.saveNote")}
						</NeonGlow>
					</span>
				</div>
			</form>
		</div>
	);
};

export const mount = async (el: HTMLElement) => {
	await initPromise;
	render(<ConfigClient />, el);
};
