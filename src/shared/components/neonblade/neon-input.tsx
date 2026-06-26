import { type Child, type FC, useEffect } from "hono/jsx";

type NIShape = "rectangle" | "corner-cut" | "rounded";
type NICorner =
	| "bottom-right"
	| "bottom-left"
	| "top-right"
	| "top-left"
	| "tl-br"
	| "bl-tr"
	| "all";
type NISize = "sm" | "md" | "lg";
type NIVariant = "outline" | "filled";
type NIBorderStyle = "full" | "bottom" | "none";
type NIGlowIntensity = "none" | "subtle" | "normal" | "strong";

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
	orange: "#ff9900",
	purple: "#bf00ff",
	red: "#ff3333",
};

function resolveColor(c: string | undefined, fallback: string): string {
	if (!c) return fallback;
	return COLOR_PRESETS[c] ?? c;
}

const CLIP_CLASSES: Record<NICorner, string> = {
	"bottom-right": "ni-clip-br",
	"bottom-left": "ni-clip-bl",
	"top-right": "ni-clip-tr",
	"top-left": "ni-clip-tl",
	"tl-br": "ni-clip-tl-br",
	"bl-tr": "ni-clip-bl-tr",
	all: "ni-clip-all",
};

const SIZE_CLASSES: Record<
	NISize,
	{ pad: string; inputH: string; text: string; label: string; hint: string }
> = {
	sm: {
		pad: "px-3 py-1.5",
		inputH: "h-8",
		text: "text-xs",
		label: "text-[10px]",
		hint: "text-[9px]",
	},
	md: {
		pad: "px-4 py-2",
		inputH: "h-10",
		text: "text-sm",
		label: "text-xs",
		hint: "text-[10px]",
	},
	lg: {
		pad: "px-5 py-3",
		inputH: "h-12",
		text: "text-base",
		label: "text-sm",
		hint: "text-xs",
	},
};

const GLOW_SIZE: Record<NIGlowIntensity, string> = {
	none: "0px",
	subtle: "4px",
	normal: "10px",
	strong: "20px",
};

type NeonInputProps = {
	shape?: NIShape;
	corner?: NICorner;
	cornerSize?: number;
	borderStyle?: NIBorderStyle;
	color?: string;
	borderColor?: string;
	hoverColor?: string;
	focusColor?: string;
	bgColor?: string;
	bgOpacity?: number;
	textColor?: string;
	placeholderColor?: string;
	label?: string;
	labelColor?: string;
	hint?: string;
	hintColor?: string;
	error?: string;
	variant?: NIVariant;
	size?: NISize;
	glowIntensity?: NIGlowIntensity;
	prefix?: Child;
	suffix?: Child;
	className?: string;
	inputClassName?: string;
	style?: string;
	value?: string;
	placeholder?: string;
	type?: string;
	name?: string;
	id?: string;
	onInput?: (e: Event) => void;
	onChange?: (e: Event) => void;
	onKeyDown?: (e: KeyboardEvent) => void;
	readOnly?: boolean;
	disabled?: boolean;
	autoFocus?: boolean;
};

let _nid = 0;

export const NeonInput: FC<NeonInputProps> = ({
	shape = "corner-cut",
	corner = "bottom-right",
	cornerSize = 12,
	borderStyle = "full",
	color = "cyan",
	borderColor,
	hoverColor,
	focusColor,
	bgColor = "#0a0f14",
	bgOpacity = 100,
	textColor,
	placeholderColor,
	label,
	labelColor,
	hint,
	hintColor,
	error,
	variant = "outline",
	size = "md",
	glowIntensity = "normal",
	prefix,
	suffix,
	className = "",
	inputClassName = "",
	style,
	value,
	placeholder,
	type = "text",
	name,
	id: idProp,
	onInput,
	onChange,
	onKeyDown,
	readOnly,
	disabled,
	autoFocus,
}) => {
	const generatedId = `ni-${++_nid}`;
	const inputId = idProp ?? generatedId;

	useEffect(() => {
		if (autoFocus) {
			const el = document.getElementById(inputId);
			if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
		}
	}, [autoFocus, inputId]);

	const accent = resolveColor(color, "#00f3ff");
	const resolvedBorder = resolveColor(borderColor, accent);
	const resolvedHover = resolveColor(hoverColor, accent);
	const resolvedFocus = resolveColor(focusColor, accent);
	const resolvedText = resolveColor(textColor, "#e0f8ff");
	const resolvedPh = resolveColor(placeholderColor, `${accent}59`);
	const resolvedLabel = resolveColor(labelColor, `${accent}a6`);
	const resolvedHint = resolveColor(hintColor, "rgba(255,255,255,0.35)");

	const hasError = Boolean(error);
	const activeBorder = hasError ? "#ff4444" : resolvedBorder;
	const activeFocus = hasError ? "#ff4444" : resolvedFocus;

	let innerBg = bgColor ?? "#0a0f14";
	if (variant === "filled")
		innerBg = `color-mix(in srgb, ${accent} 10%, ${innerBg})`;
	if (bgOpacity < 100)
		innerBg = `color-mix(in srgb, ${innerBg} ${bgOpacity}%, #020208)`;

	const clipClass = shape === "corner-cut" ? CLIP_CLASSES[corner] : "";
	const radiusClass = shape === "rounded" ? "rounded-md" : "";
	const glow = GLOW_SIZE[glowIntensity];
	const sc = SIZE_CLASSES[size];

	const contentRow = (
		<>
			{prefix && (
				<span class="ni-prefix" style={`color:${accent}`}>
					{prefix}
				</span>
			)}
			<input
				id={inputId}
				class={`ni-input font-mono ${sc.inputH} ${sc.text} ${inputClassName}`}
				style={`color:${resolvedText};--ni-ph-color:${resolvedPh}`}
				type={type}
				disabled={disabled}
				{...(name !== undefined ? { name } : {})}
				{...(value !== undefined ? { value } : {})}
				{...(placeholder !== undefined ? { placeholder } : {})}
				{...(readOnly !== undefined ? { readOnly } : {})}
				{...(onInput !== undefined ? { onInput } : {})}
				{...(onChange !== undefined ? { onChange } : {})}
				{...(onKeyDown !== undefined ? { onKeyDown } : {})}
			/>
			{suffix && (
				<span class="ni-suffix" style={`color:${accent}`}>
					{suffix}
				</span>
			)}
		</>
	);

	let shell: Child;
	if (borderStyle === "full") {
		shell = (
			<div class={`ni-outer relative p-px ${radiusClass}`}>
				<div
					class={`ni-border-frame absolute inset-0 ${clipClass} ${radiusClass} pointer-events-none`}
					aria-hidden="true"
				/>
				<div
					class={`ni-inner relative z-10 flex items-center gap-2 ${clipClass} ${radiusClass} ${sc.pad}`}
					style={`background:${innerBg}`}
				>
					{contentRow}
				</div>
			</div>
		);
	} else if (borderStyle === "bottom") {
		shell = (
			<div
				class={`ni-bottom-shell flex items-center gap-2 ${sc.pad}`}
				style={`background:${innerBg}`}
			>
				{contentRow}
			</div>
		);
	} else {
		shell = (
			<div
				class={`ni-borderless-shell flex items-center gap-2 ${clipClass} ${radiusClass} ${sc.pad}`}
				style={`background:${innerBg}`}
			>
				{contentRow}
			</div>
		);
	}

	const rootStyle = [
		`--ni-accent:${accent}`,
		`--ni-border:${activeBorder}`,
		`--ni-hover:${resolvedHover}`,
		`--ni-focus:${activeFocus}`,
		`--ni-glow:${glow}`,
		`--ni-corner:${cornerSize}px`,
		style ?? "",
	]
		.filter(Boolean)
		.join(";");

	return (
		<div
			class={`ni-field-root${disabled ? " ni-disabled" : ""}${className ? ` ${className}` : ""}`}
			style={rootStyle}
		>
			{label && (
				<label
					for={inputId}
					class={`ni-label font-orbitron tracking-widest uppercase ${sc.label}`}
					style={`color:${resolvedLabel}`}
				>
					{label}
				</label>
			)}
			<div class="ni-glow-wrapper">{shell}</div>
			{(hint || error) && (
				<span
					class={`ni-hint font-mono ${sc.hint}`}
					style={`color:${hasError ? "#ff4444" : resolvedHint}`}
				>
					{error ?? hint}
				</span>
			)}
		</div>
	);
};

export const neonInputCss = `
/* NeonInput CSS — ported from neonblade-ui reference implementation */
/*
 * Clip-path geometry, focus glow, hover/focus border transitions,
 * bottom-border style. Layout / typography / padding handled by Tailwind.
 *
 * CSS custom properties (set on ni-field-root):
 *   --ni-accent : main accent color
 *   --ni-border : border color (default state)
 *   --ni-hover  : border color on hover
 *   --ni-focus  : border + glow color on focus
 *   --ni-glow   : drop-shadow spread radius
 *   --ni-corner : diagonal cut depth
 */

.ni-field-root {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.ni-disabled { opacity: 0.45; pointer-events: none; user-select: none; }

.ni-label {
  display: block;
  letter-spacing: 0.12em;
  line-height: 1;
  margin-bottom: 2px;
}

/* Glow wrapper — drop-shadow lives here, outside clip-path */
.ni-glow-wrapper { position: relative; transition: filter 0.25s ease; }
.ni-glow-wrapper:focus-within {
  filter: drop-shadow(0 0 var(--ni-glow, 10px) var(--ni-focus));
}

/* Border frame (full border style) — clip-path + bg = accent, visible as 1px ring */
.ni-border-frame {
  background: var(--ni-border);
  transition: background 0.2s ease;
}
.ni-glow-wrapper:hover .ni-border-frame { background: var(--ni-hover); }
.ni-glow-wrapper:focus-within .ni-border-frame { background: var(--ni-focus); }

/* CSS border fallback (ghost / transparent bg) */
.ni-border-css {
  border: 1px solid var(--ni-border);
  transition: border-color 0.2s ease;
}
.ni-glow-wrapper:hover .ni-border-css { border-color: var(--ni-hover); }
.ni-glow-wrapper:focus-within .ni-border-css { border-color: var(--ni-focus); }

/* Bottom-only border style */
.ni-bottom-shell {
  border-bottom: 1px solid var(--ni-border);
  transition: border-color 0.2s ease;
}
.ni-glow-wrapper:hover .ni-bottom-shell { border-color: var(--ni-hover); }
.ni-glow-wrapper:focus-within .ni-bottom-shell { border-color: var(--ni-focus); }

/* Input element */
.ni-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  caret-color: var(--ni-accent);
}
.ni-input::placeholder { color: var(--ni-ph-color); }

/* Kill browser autofill yellow background */
.ni-input:-webkit-autofill,
.ni-input:-webkit-autofill:hover,
.ni-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #0a0f14 inset;
  -webkit-text-fill-color: inherit;
  transition: background-color 9999s ease-in-out 0s;
}
/* Hide password reveal eye (Edge / IE) */
.ni-input::-ms-reveal { display: none; }
/* Hide number input spinners */
.ni-input[type="number"]::-webkit-inner-spin-button,
.ni-input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.ni-input[type="number"] { -moz-appearance: textfield; }

/* Prefix / Suffix */
.ni-prefix,
.ni-suffix {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  user-select: none;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}
.ni-glow-wrapper:focus-within .ni-prefix,
.ni-glow-wrapper:focus-within .ni-suffix { opacity: 1; }

/* Hint / Error */
.ni-hint { display: block; line-height: 1.4; letter-spacing: 0.04em; }

/* Clip-path geometry */
.ni-clip-br {
  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(100% - var(--ni-corner, 12px)),
    calc(100% - var(--ni-corner, 12px)) 100%,
    0 100%
  );
}
.ni-clip-bl {
  clip-path: polygon(
    0 0,
    100% 0,
    100% 100%,
    var(--ni-corner, 12px) 100%,
    0 calc(100% - var(--ni-corner, 12px))
  );
}
.ni-clip-tr {
  clip-path: polygon(
    0 0,
    calc(100% - var(--ni-corner, 12px)) 0,
    100% var(--ni-corner, 12px),
    100% 100%,
    0 100%
  );
}
.ni-clip-tl {
  clip-path: polygon(
    var(--ni-corner, 12px) 0,
    100% 0,
    100% 100%,
    0 100%,
    0 var(--ni-corner, 12px)
  );
}
.ni-clip-all {
  clip-path: polygon(
    var(--ni-corner, 12px) 0,
    calc(100% - var(--ni-corner, 12px)) 0,
    100% var(--ni-corner, 12px),
    100% calc(100% - var(--ni-corner, 12px)),
    calc(100% - var(--ni-corner, 12px)) 100%,
    var(--ni-corner, 12px) 100%,
    0 calc(100% - var(--ni-corner, 12px)),
    0 var(--ni-corner, 12px)
  );
}
.ni-clip-tl-br {
  clip-path: polygon(
    var(--ni-corner, 12px) 0,
    100% 0,
    100% calc(100% - var(--ni-corner, 12px)),
    calc(100% - var(--ni-corner, 12px)) 100%,
    0 100%,
    0 var(--ni-corner, 12px)
  );
}
.ni-clip-bl-tr {
  clip-path: polygon(
    0 0,
    calc(100% - var(--ni-corner, 12px)) 0,
    100% var(--ni-corner, 12px),
    100% 100%,
    var(--ni-corner, 12px) 100%,
    0 calc(100% - var(--ni-corner, 12px))
  );
}
`;
