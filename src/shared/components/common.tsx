// Shared common CSS + JSX components for spinner, loading-row, result-card, copy-btn, page-header
// Used by release/end/mr/watch/config Web UI pages
import { type Child, type FC, useEffect, useRef, useState } from "hono/jsx";
import { t } from "../i18n";
import { CornerCutButton } from "./neonblade/corner-cut-button";
import { GlitchText } from "./neonblade/glitch-text";
import { NeonGlow } from "./neonblade/neon-glow";
import { ProgressBar } from "./neonblade/progress-bar";

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
  border-color: rgba(0,243,255,0.12);
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
  border-bottom: 1px dashed rgba(0,243,255,0.3);
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

/* ── Hint (inline helper text, e.g. after a field label) ── */
.hint {
  font-weight: 300;
  color: var(--text-3);
  font-size: 11px;
  margin-left: 4px;
}
`;

export const pageHeaderCss = `
.page-header {
  margin-bottom: 28px;
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
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
`;

// ── JSX Components ──

type LoadingRowProps = { text: string; color?: string };
export const LoadingRow: FC<LoadingRowProps> = ({
	text,
	color = "#00f3ff",
}) => (
	<div
		class="loading-row"
		style="flex-direction:column;align-items:stretch;gap:8px;padding:10px 0"
	>
		<NeonGlow colors={color} glowIntensity="subtle">
			{text}
		</NeonGlow>
		<ProgressBar
			value={100}
			variant="striped"
			pulse
			color={color}
			size="sm"
			glow
		/>
	</div>
);

type ResultCardProps = {
	variant?: "success" | "error" | "default";
	label?: string;
	children: unknown;
};
export const ResultCard: FC<ResultCardProps> = ({
	variant,
	label,
	children,
}) => {
	const cls = `result-card${variant === "success" ? " result-success" : ""}${variant === "error" ? " result-error" : ""}`;
	return (
		<div class={cls}>
			{label && <div class="result-label">{label}</div>}
			{children}
		</div>
	);
};

type ResultTextProps = {
	variant?: "success" | "error";
	children: unknown;
};
export const ResultText: FC<ResultTextProps> = ({ variant, children }) => (
	<div class={`result-text${variant ? ` ${variant}` : ""}`}>{children}</div>
);

type PageHeaderProps = { title: Child; description: Child };
export const PageHeader: FC<PageHeaderProps> = ({ title, description }) => (
	<div class="page-header">
		<h2>{title}</h2>
		<p>{description}</p>
	</div>
);

export const sectionTitle = (color: string, text: string) => (
	<GlitchText
		neon
		mode="active"
		colorA={color}
		colorB={color}
		glowColor={color}
		speed="slow"
		style="font-size:1.5rem;font-weight:700"
	>
		{text}
	</GlitchText>
);

export const fieldLabel = (color: string, text: string) => (
	<GlitchText neon mode="hover" colorA={color} colorB={color} glowColor={color}>
		{text}
	</GlitchText>
);

export const hint = (color: string, text: string) => (
	<span class="hint">
		<NeonGlow colors={color} glowIntensity="subtle">
			{text}
		</NeonGlow>
	</span>
);

type CopyButtonProps = { text: string; copyText: string };
export const CopyButton: FC<CopyButtonProps> = ({ text, copyText }) => {
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);
	const doCopy = async () => {
		try {
			await navigator.clipboard.writeText(copyText);
			setCopied(true);
			timerRef.current = setTimeout(() => setCopied(false), 2000);
		} catch {
			/* clipboard not available */
		}
	};
	return (
		<CornerCutButton
			color={copied ? "green" : "cyan"}
			variant="solid"
			size="xs"
			onClick={doCopy}
		>
			{copied ? t("web.copied") : text}
		</CornerCutButton>
	);
};
