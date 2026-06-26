import type { Child, FC } from "hono/jsx";

type BBCColor = "cyan" | "pink" | "green" | (string & {});
type BBCSize = "sm" | "md" | "lg" | "xl";
type BBCCorner =
	| "bottom-right"
	| "bottom-left"
	| "top-right"
	| "top-left"
	| "all";
type BBCVariant = "single" | "dual" | "gradient-sweep" | "rainbow" | "pulse";
type BBCGlowIntensity = "none" | "low" | "medium" | "high";

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
};

const CORNER_CLASSES: Record<BBCCorner, string> = {
	"bottom-right": "bbc-clip-br",
	"bottom-left": "bbc-clip-bl",
	"top-right": "bbc-clip-tr",
	"top-left": "bbc-clip-tl",
	all: "bbc-clip-all",
};

type BorderBeamCornerCutCardProps = {
	children?: Child;
	icon?: Child;
	title?: string;
	description?: string;
	beamColor?: BBCColor;
	beamColorB?: BBCColor;
	variant?: BBCVariant;
	duration?: number;
	durationB?: number;
	borderWidth?: number | string;
	size?: BBCSize;
	corner?: BBCCorner;
	cornerSize?: number;
	glowIntensity?: BBCGlowIntensity;
	bgColor?: string;
	innerClassName?: string;
	className?: string;
	style?: string;
};

const INNER_PADDING: Record<BBCSize, string> = {
	sm: "p-5",
	md: "p-6",
	lg: "p-8",
	xl: "p-10",
};
const ICON_BOX_SIZE: Record<BBCSize, string> = {
	sm: "w-9 h-9",
	md: "w-12 h-12",
	lg: "w-14 h-14",
	xl: "w-16 h-16",
};
const ICON_SIZE: Record<BBCSize, string> = {
	sm: "w-4 h-4",
	md: "w-6 h-6",
	lg: "w-8 h-8",
	xl: "w-9 h-9",
};
const TITLE_SIZE: Record<BBCSize, string> = {
	sm: "text-sm",
	md: "text-lg",
	lg: "text-[1.375rem]",
	xl: "text-[1.625rem]",
};
const DESC_SIZE: Record<BBCSize, string> = {
	sm: "text-xs",
	md: "text-sm",
	lg: "text-base",
	xl: "text-lg",
};

export const BorderBeamCornerCutCard: FC<BorderBeamCornerCutCardProps> = ({
	children,
	icon,
	title,
	description,
	beamColor = "pink",
	beamColorB = "cyan",
	variant = "single",
	duration = 4,
	durationB = 6,
	borderWidth = "2px",
	size = "md",
	corner = "bottom-right",
	cornerSize = 20,
	glowIntensity = "medium",
	bgColor,
	className = "",
	innerClassName = "",
	style,
}) => {
	const resolvedA = COLOR_PRESETS[beamColor] ?? beamColor;
	const resolvedB = COLOR_PRESETS[beamColorB] ?? beamColorB;
	const borderWidthValue =
		typeof borderWidth === "number" ? `${borderWidth}px` : borderWidth;
	const cornerClass = CORNER_CLASSES[corner];

	const outerClasses = [
		"bbc-wrapper",
		"relative w-full overflow-hidden bg-white/[0.05]",
		`bbc-variant-${variant}`,
		glowIntensity !== "none" ? `bbc-glow-${glowIntensity}` : "",
		cornerClass,
		className,
	]
		.filter(Boolean)
		.join(" ");

	const outerStyle = [
		`--bbc-beam-color:${resolvedA}`,
		`--bbc-beam-color-b:${resolvedB}`,
		`--bbc-corner-size:${cornerSize}px`,
		`--bbc-duration:${duration}s`,
		`--bbc-duration-b:${durationB}s`,
		`padding:${borderWidthValue}`,
		style ?? "",
	]
		.filter(Boolean)
		.join(";");

	return (
		<div class={outerClasses} style={outerStyle}>
			<div class="bbc-beam" aria-hidden="true" />

			{variant === "dual" && <div class="bbc-beam-b" aria-hidden="true" />}

			<div
				class={[
					"bbc-inner",
					"relative z-10 w-full flex flex-col",
					cornerClass,
					INNER_PADDING[size],
					innerClassName,
				]
					.filter(Boolean)
					.join(" ")}
				style={`background-color:${bgColor ?? "var(--background, #050505)"}`}
			>
				{icon && (
					<div
						class={[
							"bbc-icon-box",
							"border border-white/10 bg-black rounded-[4px] flex items-center justify-center shrink-0 mb-6 transition-[border-color,box-shadow] duration-300",
							ICON_BOX_SIZE[size],
						].join(" ")}
					>
						<span
							class={[
								"bbc-icon",
								"text-white/70 flex items-center justify-center transition-colors duration-300",
								ICON_SIZE[size],
							].join(" ")}
						>
							{icon}
						</span>
					</div>
				)}
				{title && (
					<h3
						class={[
							"bbc-title",
							"font-orbitron font-bold text-white mb-3 leading-[1.3] transition-[text-shadow] duration-300",
							TITLE_SIZE[size],
						].join(" ")}
					>
						{title}
					</h3>
				)}
				{description && (
					<p
						class={[
							"text-white/60 leading-[1.65] flex-grow",
							DESC_SIZE[size],
						].join(" ")}
					>
						{description}
					</p>
				)}
				{children}
			</div>
		</div>
	);
};

export const borderBeamCornerCutCardCss = `
.bbc-clip-br {
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--bbc-corner-size, 20px)), calc(100% - var(--bbc-corner-size, 20px)) 100%, 0 100%);
}
.bbc-clip-bl {
  clip-path: polygon(0 0, 100% 0, 100% 100%, var(--bbc-corner-size, 20px) 100%, 0 calc(100% - var(--bbc-corner-size, 20px)));
}
.bbc-clip-tr {
  clip-path: polygon(0 0, calc(100% - var(--bbc-corner-size, 20px)) 0, 100% var(--bbc-corner-size, 20px), 100% 100%, 0 100%);
}
.bbc-clip-tl {
  clip-path: polygon(var(--bbc-corner-size, 20px) 0, 100% 0, 100% 100%, 0 100%, 0 var(--bbc-corner-size, 20px));
}
.bbc-clip-all {
  clip-path: polygon(var(--bbc-corner-size, 20px) 0, 100% 0, 100% calc(100% - var(--bbc-corner-size, 20px)), calc(100% - var(--bbc-corner-size, 20px)) 100%, 0 100%, 0 var(--bbc-corner-size, 20px));
}

@keyframes bbc-spin-cw {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes bbc-spin-ccw {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

@keyframes bbc-pulse-opacity {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

@keyframes bbc-rainbow-hue {
  from { filter: hue-rotate(0deg); }
  to { filter: hue-rotate(360deg); }
}

.bbc-beam {
  position: absolute;
  inset: -100%;
  background: conic-gradient(from 90deg at 50% 50%, transparent 50%, var(--bbc-beam-color, #ff00ff) 100%);
  animation: bbc-spin-cw var(--bbc-duration, 4s) linear infinite;
}

.bbc-beam-b {
  position: absolute;
  inset: -100%;
  background: conic-gradient(from 270deg at 50% 50%, transparent 50%, var(--bbc-beam-color-b, #00f3ff) 100%);
  animation: bbc-spin-ccw var(--bbc-duration-b, 6s) linear infinite;
}

.bbc-variant-gradient-sweep .bbc-beam {
  background: conic-gradient(
    from 90deg at 50% 50%,
    transparent 38%,
    color-mix(in srgb, var(--bbc-beam-color, #ff00ff) 40%, transparent) 55%,
    var(--bbc-beam-color, #ff00ff) 70%,
    var(--bbc-beam-color-b, #00f3ff) 85%,
    transparent 100%
  );
}

.bbc-variant-rainbow .bbc-beam {
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
    bbc-spin-cw var(--bbc-duration, 4s) linear infinite,
    bbc-rainbow-hue 4s linear infinite;
}

.bbc-variant-pulse .bbc-beam {
  animation:
    bbc-spin-cw var(--bbc-duration, 4s) linear infinite,
    bbc-pulse-opacity 1.4s ease-in-out infinite;
}

.bbc-glow-low .bbc-inner {
  box-shadow: 0 0 8px color-mix(in srgb, var(--bbc-beam-color, #ff00ff) 35%, transparent);
}

.bbc-glow-medium .bbc-inner {
  box-shadow:
    0 0 15px color-mix(in srgb, var(--bbc-beam-color, #ff00ff) 50%, transparent),
    inset 0 0 10px color-mix(in srgb, var(--bbc-beam-color, #ff00ff) 15%, transparent);
}

.bbc-glow-high .bbc-inner {
  box-shadow:
    0 0 28px var(--bbc-beam-color, #ff00ff),
    0 0 50px color-mix(in srgb, var(--bbc-beam-color, #ff00ff) 40%, transparent),
    inset 0 0 20px color-mix(in srgb, var(--bbc-beam-color, #ff00ff) 25%, transparent);
}

.bbc-wrapper:hover .bbc-icon-box {
  border-color: var(--bbc-beam-color, #ff00ff);
  box-shadow:
    0 0 12px color-mix(in srgb, var(--bbc-beam-color, #ff00ff) 50%, transparent),
    inset 0 0 8px color-mix(in srgb, var(--bbc-beam-color, #ff00ff) 20%, transparent);
}

.bbc-wrapper:hover .bbc-icon {
  color: var(--bbc-beam-color, #ff00ff);
}

.bbc-wrapper:hover .bbc-title {
  text-shadow:
    0 0 10px var(--bbc-beam-color, #ff00ff),
    0 0 20px var(--bbc-beam-color, #ff00ff);
}
`;
