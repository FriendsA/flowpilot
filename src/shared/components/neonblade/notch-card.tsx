import type { Child, FC } from "hono/jsx";

type NCNotchSide = "top" | "bottom" | "left" | "right";
type NCColor = "cyan" | "pink" | "green" | (string & {});
type NCSize = "sm" | "md" | "lg" | "xl";
type NCBeamVariant =
	| "none"
	| "single"
	| "dual"
	| "gradient-sweep"
	| "rainbow"
	| "pulse";
type NCHoverEffect = "glow" | "scan" | "pulse" | "lift" | "none";
type NCGlowIntensity = "none" | "low" | "medium" | "high";

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
};

function resolveColor(c: NCColor): string {
	return COLOR_PRESETS[c] ?? c;
}

function buildClipPath(
	notchSides: NCNotchSide[],
	notchSize: number,
	notchWidth: number,
	notchWidthV: number,
	notchSkew: number,
): string {
	const hasTop = notchSides.includes("top");
	const hasRight = notchSides.includes("right");
	const hasBottom = notchSides.includes("bottom");
	const hasLeft = notchSides.includes("left");

	const d = notchSize;
	const wH = notchWidth;
	const wV = notchWidthV;
	const sk = notchSkew;
	const halfH = wH / 2 + sk;
	const halfV = wV / 2 + sk;

	const pts: string[] = [];
	const pt = (x: string, y: string) => pts.push(`${x} ${y}`);

	const topNotch = () => {
		pt(`calc(50% - ${halfH}px)`, "0");
		pt(`calc(50% - ${wH / 2}px)`, `${d}px`);
		pt(`calc(50% + ${wH / 2}px)`, `${d}px`);
		pt(`calc(50% + ${halfH}px)`, "0");
	};

	const rightNotch = () => {
		pt("100%", `calc(50% - ${halfV}px)`);
		pt(`calc(100% - ${d}px)`, `calc(50% - ${wV / 2}px)`);
		pt(`calc(100% - ${d}px)`, `calc(50% + ${wV / 2}px)`);
		pt("100%", `calc(50% + ${halfV}px)`);
	};

	const bottomNotch = () => {
		pt(`calc(50% + ${halfH}px)`, "100%");
		pt(`calc(50% + ${wH / 2}px)`, `calc(100% - ${d}px)`);
		pt(`calc(50% - ${wH / 2}px)`, `calc(100% - ${d}px)`);
		pt(`calc(50% - ${halfH}px)`, "100%");
	};

	const leftNotch = () => {
		pt("0", `calc(50% + ${halfV}px)`);
		pt(`${d}px`, `calc(50% + ${wV / 2}px)`);
		pt(`${d}px`, `calc(50% - ${wV / 2}px)`);
		pt("0", `calc(50% - ${halfV}px)`);
	};

	pt("0", "0");

	if (hasTop) topNotch();
	pt("100%", "0");

	if (hasRight) rightNotch();
	pt("100%", "100%");

	if (hasBottom) bottomNotch();
	pt("0", "100%");

	if (hasLeft) leftNotch();

	return `polygon(${pts.join(", ")})`;
}

const INNER_PADDING: Record<NCSize, string> = {
	sm: "p-4",
	md: "p-6",
	lg: "p-8",
	xl: "p-10",
};

const TITLE_SIZE: Record<NCSize, string> = {
	sm: "text-sm",
	md: "text-lg",
	lg: "text-xl",
	xl: "text-2xl",
};

const DESC_SIZE: Record<NCSize, string> = {
	sm: "text-xs",
	md: "text-sm",
	lg: "text-base",
	xl: "text-lg",
};

const ICON_BOX_SIZE: Record<NCSize, string> = {
	sm: "w-9 h-9",
	md: "w-12 h-12",
	lg: "w-14 h-14",
	xl: "w-16 h-16",
};

const ICON_SIZE: Record<NCSize, string> = {
	sm: "w-4 h-4",
	md: "w-6 h-6",
	lg: "w-8 h-8",
	xl: "w-9 h-9",
};

type NotchCardProps = {
	children?: Child;
	icon?: Child;
	title?: string;
	description?: string;
	notchSides?: NCNotchSide[];
	notchSize?: number;
	notchWidth?: number;
	notchWidthV?: number;
	notchSkew?: number;
	borderWidth?: number | string;
	borderColor?: NCColor;
	borderColorB?: NCColor;
	borderGradient?: boolean;
	beamVariant?: NCBeamVariant;
	beamColor?: NCColor;
	beamColorB?: NCColor;
	beamDuration?: number;
	beamDurationB?: number;
	cardColor?: string;
	textColor?: string;
	accentColor?: NCColor;
	glowIntensity?: NCGlowIntensity;
	hoverEffect?: NCHoverEffect;
	size?: NCSize;
	align?: "start" | "center";
	innerClassName?: string;
	className?: string;
	style?: string;
};

export const NotchCard: FC<NotchCardProps> = ({
	children,
	icon,
	title,
	description,
	notchSides = ["top", "bottom"],
	notchSize = 12,
	notchWidth = 50,
	notchWidthV,
	notchSkew = 12,
	borderWidth = "2px",
	borderColor = "cyan",
	borderColorB = "pink",
	borderGradient = false,
	beamVariant = "none",
	beamColor = "cyan",
	beamColorB = "pink",
	beamDuration = 4,
	beamDurationB = 6,
	cardColor,
	textColor,
	accentColor,
	glowIntensity = "medium",
	hoverEffect = "glow",
	size = "md",
	align = "start",
	className = "",
	innerClassName = "",
	style,
}) => {
	const validSides: NCNotchSide[] =
		notchSides.length > 0 ? notchSides : ["top", "bottom"];

	const resolvedBorderColor = resolveColor(borderColor);
	const resolvedBorderColorB = resolveColor(borderColorB);
	const resolvedBeamColor = resolveColor(beamColor);
	const resolvedBeamColorB = resolveColor(beamColorB);
	const resolvedAccent = resolveColor(
		accentColor ?? (beamVariant !== "none" ? beamColor : borderColor),
	);

	const bwValue =
		typeof borderWidth === "number" ? `${borderWidth}px` : borderWidth;

	const clipPath = buildClipPath(
		validSides,
		notchSize,
		notchWidth,
		notchWidthV ?? notchWidth,
		notchSkew,
	);

	const hasBeam = beamVariant !== "none";

	let outerBg: string;
	if (hasBeam) {
		outerBg = "transparent";
	} else if (borderGradient) {
		outerBg = `linear-gradient(135deg, ${resolvedBorderColor}, ${resolvedBorderColorB})`;
	} else {
		outerBg = resolvedBorderColor;
	}

	const outerClasses = [
		"nc-wrapper",
		"relative overflow-hidden",
		hasBeam ? `nc-beam-${beamVariant}` : "",
		glowIntensity !== "none" ? `nc-glow-${glowIntensity}` : "",
		`nc-hover-${hoverEffect}`,
		className,
	]
		.filter(Boolean)
		.join(" ");

	const innerClasses = [
		"nc-inner",
		"relative z-10 w-full h-full flex flex-col",
		align === "center" ? "items-center text-center" : "",
		INNER_PADDING[size],
		innerClassName,
	]
		.filter(Boolean)
		.join(" ");

	const outerStyle = [
		`--nc-accent:${resolvedAccent}`,
		`--nc-border-color:${resolvedBorderColor}`,
		`--nc-border-color-b:${resolvedBorderColorB}`,
		`--nc-beam-color:${resolvedBeamColor}`,
		`--nc-beam-color-b:${resolvedBeamColorB}`,
		`--nc-duration:${beamDuration}s`,
		`--nc-duration-b:${beamDurationB}s`,
		`background:${outerBg}`,
		`padding:${bwValue}`,
		`clip-path:${clipPath}`,
		style ?? "",
	]
		.filter(Boolean)
		.join(";");

	const innerStyle = [
		`background-color:${cardColor ?? "var(--background, #050505)"}`,
		textColor ? `color:${textColor}` : "",
		`clip-path:${clipPath}`,
	]
		.filter(Boolean)
		.join(";");

	return (
		<div class={outerClasses} style={outerStyle}>
			{hasBeam && <div class="nc-beam" aria-hidden="true" />}

			{beamVariant === "dual" && <div class="nc-beam-b" aria-hidden="true" />}

			<div class={innerClasses} style={innerStyle}>
				{icon && (
					<div
						class={[
							"nc-icon-box",
							ICON_BOX_SIZE[size],
							align === "center" ? "self-center" : "",
							"mb-4 flex shrink-0 items-center justify-center border border-white/20 bg-white/[0.04]",
						]
							.filter(Boolean)
							.join(" ")}
					>
						<div
							class={["nc-icon", ICON_SIZE[size], "text-white/60"].join(" ")}
						>
							{icon}
						</div>
					</div>
				)}

				{title && (
					<h3
						class={[
							"nc-title",
							"font-orbitron font-semibold text-white",
							TITLE_SIZE[size],
							icon || children ? "mb-1" : "",
						].join(" ")}
					>
						{title}
					</h3>
				)}

				{description && (
					<p
						class={[
							"nc-desc",
							"text-white/55 leading-relaxed",
							DESC_SIZE[size],
							children ? "mb-3" : "",
						].join(" ")}
					>
						{description}
					</p>
				)}

				{children}
			</div>

			{hoverEffect === "scan" && (
				<div class="nc-scan-line" aria-hidden="true" />
			)}
		</div>
	);
};

export const notchCardCss = `
@keyframes nc-spin-cw {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes nc-spin-ccw {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

@keyframes nc-pulse-opacity {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

@keyframes nc-rainbow-hue {
  from { filter: hue-rotate(0deg); }
  to { filter: hue-rotate(360deg); }
}

@keyframes nc-scan-sweep {
  0% { transform: translateY(-100%); opacity: 0; }
  15% { opacity: 0.7; }
  85% { opacity: 0.7; }
  100% { transform: translateY(350%); opacity: 0; }
}

@keyframes nc-pulse-glow {
  0%, 100% {
    box-shadow:
      0 0 10px color-mix(in srgb, var(--nc-accent, #00f3ff) 40%, transparent),
      inset 0 0 8px color-mix(in srgb, var(--nc-accent, #00f3ff) 8%, transparent);
  }
  50% {
    box-shadow:
      0 0 28px var(--nc-accent, #00f3ff),
      0 0 55px color-mix(in srgb, var(--nc-accent, #00f3ff) 35%, transparent),
      inset 0 0 20px color-mix(in srgb, var(--nc-accent, #00f3ff) 18%, transparent);
  }
}

.nc-inner {
  transition: box-shadow 0.3s ease;
}

.nc-beam {
  position: absolute;
  inset: -100%;
  background: conic-gradient(from 90deg at 50% 50%, transparent 50%, var(--nc-beam-color, #00f3ff) 100%);
  animation: nc-spin-cw var(--nc-duration, 4s) linear infinite;
}

.nc-beam-b {
  position: absolute;
  inset: -100%;
  background: conic-gradient(from 270deg at 50% 50%, transparent 50%, var(--nc-beam-color-b, #ff00ff) 100%);
  animation: nc-spin-ccw var(--nc-duration-b, 6s) linear infinite;
}

.nc-beam-gradient-sweep .nc-beam {
  background: conic-gradient(
    from 90deg at 50% 50%,
    transparent 38%,
    color-mix(in srgb, var(--nc-beam-color, #00f3ff) 40%, transparent) 55%,
    var(--nc-beam-color, #00f3ff) 70%,
    var(--nc-beam-color-b, #ff00ff) 85%,
    transparent 100%
  );
}

.nc-beam-rainbow .nc-beam {
  background: conic-gradient(
    from 90deg at 50% 50%,
    transparent 50%,
    #ff00ff 60%,
    #00f3ff 72%,
    #39ff14 83%,
    #ff9900 92%,
    transparent 100%
  );
  animation:
    nc-spin-cw var(--nc-duration, 4s) linear infinite,
    nc-rainbow-hue 4s linear infinite;
}

.nc-beam-pulse .nc-beam {
  animation:
    nc-spin-cw var(--nc-duration, 4s) linear infinite,
    nc-pulse-opacity 1.4s ease-in-out infinite;
}

.nc-glow-low .nc-inner {
  box-shadow: 0 0 8px color-mix(in srgb, var(--nc-accent, #00f3ff) 35%, transparent);
}

.nc-glow-medium .nc-inner {
  box-shadow:
    0 0 15px color-mix(in srgb, var(--nc-accent, #00f3ff) 50%, transparent),
    inset 0 0 10px color-mix(in srgb, var(--nc-accent, #00f3ff) 10%, transparent);
}

.nc-glow-high .nc-inner {
  box-shadow:
    0 0 28px var(--nc-accent, #00f3ff),
    0 0 50px color-mix(in srgb, var(--nc-accent, #00f3ff) 40%, transparent),
    inset 0 0 20px color-mix(in srgb, var(--nc-accent, #00f3ff) 20%, transparent);
}

.nc-hover-glow:hover .nc-inner {
  box-shadow:
    0 0 22px var(--nc-accent, #00f3ff),
    0 0 45px color-mix(in srgb, var(--nc-accent, #00f3ff) 45%, transparent),
    inset 0 0 18px color-mix(in srgb, var(--nc-accent, #00f3ff) 15%, transparent);
}

.nc-hover-lift {
  transition: transform 0.3s ease;
}
.nc-hover-lift:hover {
  transform: translateY(-5px) scale(1.015);
}
.nc-hover-lift:hover .nc-inner {
  box-shadow:
    0 10px 35px color-mix(in srgb, var(--nc-accent, #00f3ff) 50%, transparent),
    inset 0 0 15px color-mix(in srgb, var(--nc-accent, #00f3ff) 12%, transparent);
}

.nc-hover-pulse:hover .nc-inner {
  animation: nc-pulse-glow 1.5s ease-in-out infinite;
}

.nc-scan-line {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 15;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    color-mix(in srgb, var(--nc-accent, #00f3ff) 12%, transparent) 45%,
    color-mix(in srgb, var(--nc-accent, #00f3ff) 18%, transparent) 50%,
    color-mix(in srgb, var(--nc-accent, #00f3ff) 12%, transparent) 55%,
    transparent 100%
  );
  transform: translateY(-100%);
  opacity: 0;
}

.nc-hover-scan:hover .nc-scan-line {
  animation: nc-scan-sweep 2.2s ease-in-out infinite;
}

.nc-title {
  transition: text-shadow 0.3s ease;
}

.nc-wrapper:hover .nc-title {
  text-shadow:
    0 0 10px var(--nc-accent, #00f3ff),
    0 0 22px color-mix(in srgb, var(--nc-accent, #00f3ff) 55%, transparent);
}

.nc-icon-box {
  transition:
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}

.nc-wrapper:hover .nc-icon-box {
  border-color: var(--nc-accent, #00f3ff);
  box-shadow:
    0 0 10px color-mix(in srgb, var(--nc-accent, #00f3ff) 50%, transparent),
    inset 0 0 8px color-mix(in srgb, var(--nc-accent, #00f3ff) 12%, transparent);
}

.nc-icon {
  transition: color 0.3s ease;
}

.nc-wrapper:hover .nc-icon {
  color: var(--nc-accent, #00f3ff);
}
`;
