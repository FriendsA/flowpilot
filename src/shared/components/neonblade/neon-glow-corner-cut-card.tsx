import type { Child, FC } from "hono/jsx";

type NGCCColor = "cyan" | "pink" | "green" | (string & {});
type NGCCSize = "sm" | "md" | "lg" | "xl";
type NGCCCorner =
	| "bottom-right"
	| "bottom-left"
	| "top-right"
	| "top-left"
	| "all";
type NGCCHoverEffect =
	| "gradient"
	| "solid"
	| "glow-only"
	| "pulse"
	| "trace"
	| "none";
type NGCCGlowIntensity = "low" | "medium" | "high";

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
};

const CORNER_CLASSES: Record<NGCCCorner, string> = {
	"bottom-right": "ngcc-clip-br",
	"bottom-left": "ngcc-clip-bl",
	"top-right": "ngcc-clip-tr",
	"top-left": "ngcc-clip-tl",
	all: "ngcc-clip-all",
};

const HOVER_CLASSES: Record<NGCCHoverEffect, string> = {
	gradient: "ngcc-hover-gradient",
	solid: "ngcc-hover-solid",
	"glow-only": "ngcc-hover-glow-only",
	pulse: "ngcc-hover-pulse",
	trace: "ngcc-hover-trace",
	none: "ngcc-hover-none",
};

const GLOW_SIZES: Record<NGCCGlowIntensity, { glow: number; blur: number }> = {
	low: { glow: 8, blur: 4 },
	medium: { glow: 15, blur: 7 },
	high: { glow: 28, blur: 14 },
};

type NeonGlowCornerCutCardProps = {
	children?: Child;
	icon?: Child;
	title?: Child;
	description?: string;
	colorA?: NGCCColor;
	colorB?: NGCCColor;
	size?: NGCCSize;
	corner?: NGCCCorner;
	cornerSize?: number;
	hoverEffect?: NGCCHoverEffect;
	glowIntensity?: NGCCGlowIntensity;
	bgColor?: string;
	className?: string;
	style?: string;
};

const CARD_PADDING: Record<NGCCSize, string> = {
	sm: "p-5",
	md: "p-8",
	lg: "p-10",
	xl: "p-12",
};
const ICON_BOX_SIZE: Record<NGCCSize, string> = {
	sm: "w-9 h-9",
	md: "w-12 h-12",
	lg: "w-14 h-14",
	xl: "w-16 h-16",
};
const ICON_SIZE: Record<NGCCSize, string> = {
	sm: "w-4 h-4",
	md: "w-6 h-6",
	lg: "w-8 h-8",
	xl: "w-9 h-9",
};
const TITLE_SIZE: Record<NGCCSize, string> = {
	sm: "text-sm",
	md: "text-lg",
	lg: "text-[1.375rem]",
	xl: "text-[1.625rem]",
};
const DESC_SIZE: Record<NGCCSize, string> = {
	sm: "text-xs",
	md: "text-sm",
	lg: "text-base",
	xl: "text-lg",
};

export const NeonGlowCornerCutCard: FC<NeonGlowCornerCutCardProps> = ({
	children,
	icon,
	title,
	description,
	colorA = "cyan",
	colorB = "pink",
	size = "md",
	corner = "bottom-right",
	cornerSize = 20,
	hoverEffect = "gradient",
	glowIntensity = "medium",
	bgColor,
	className = "",
	style,
}) => {
	const resolvedA = COLOR_PRESETS[colorA] ?? colorA;
	const resolvedB = COLOR_PRESETS[colorB] ?? colorB;
	const { glow, blur } = GLOW_SIZES[glowIntensity];

	const wrapperStyle = [
		`--ngcc-color-a:${resolvedA}`,
		`--ngcc-color-b:${resolvedB}`,
		`--ngcc-corner-size:${cornerSize}px`,
		`--ngcc-glow-size:${glow}px`,
		`--ngcc-glow-blur:${blur}px`,
		style ?? "",
	]
		.filter(Boolean)
		.join(";");

	return (
		<div
			class={["relative p-px", HOVER_CLASSES[hoverEffect], className]
				.filter(Boolean)
				.join(" ")}
			style={wrapperStyle}
		>
			<div
				class="ngcc-glow absolute -inset-0.5 rounded-[3px] pointer-events-none z-0"
				aria-hidden="true"
			/>

			<div
				class={[
					"ngcc-border-frame",
					"absolute inset-0 bg-white/10 z-[5] pointer-events-none transition-[background,opacity] duration-300",
					CORNER_CLASSES[corner],
				].join(" ")}
				aria-hidden="true"
			/>

			<div
				class={[
					"ngcc-card",
					"relative flex flex-col overflow-hidden z-10 transition-[box-shadow] duration-300",
					CORNER_CLASSES[corner],
					CARD_PADDING[size],
				].join(" ")}
				style={`background-color:${bgColor ?? "#0a0a0a"}`}
			>
				{icon && (
					<div
						class={[
							"ngcc-icon-box",
							"border border-white/10 bg-black rounded-[4px] flex items-center justify-center shrink-0 mb-6 transition-[border-color,box-shadow] duration-300",
							ICON_BOX_SIZE[size],
						].join(" ")}
					>
						<span
							class={[
								"ngcc-icon",
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
							"ngcc-title",
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

export const neonGlowCornerCutCardCss = `
.ngcc-clip-br {
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--ngcc-corner-size, 20px)), calc(100% - var(--ngcc-corner-size, 20px)) 100%, 0 100%);
}
.ngcc-clip-bl {
  clip-path: polygon(0 0, 100% 0, 100% 100%, var(--ngcc-corner-size, 20px) 100%, 0 calc(100% - var(--ngcc-corner-size, 20px)));
}
.ngcc-clip-tr {
  clip-path: polygon(0 0, calc(100% - var(--ngcc-corner-size, 20px)) 0, 100% var(--ngcc-corner-size, 20px), 100% 100%, 0 100%);
}
.ngcc-clip-tl {
  clip-path: polygon(var(--ngcc-corner-size, 20px) 0, 100% 0, 100% 100%, 0 100%, 0 var(--ngcc-corner-size, 20px));
}
.ngcc-clip-all {
  clip-path: polygon(var(--ngcc-corner-size, 20px) 0, 100% 0, 100% calc(100% - var(--ngcc-corner-size, 20px)), calc(100% - var(--ngcc-corner-size, 20px)) 100%, 0 100%, 0 var(--ngcc-corner-size, 20px));
}

.ngcc-glow {
  opacity: 0;
  filter: blur(var(--ngcc-glow-blur, 7px));
  transition: opacity 500ms ease;
  background: linear-gradient(135deg, var(--ngcc-color-a, #00f3ff), var(--ngcc-color-b, #ff00ff));
}

.ngcc-card {
  transition: box-shadow 300ms ease;
}

.ngcc-hover-gradient:hover .ngcc-glow { opacity: 1; }
.ngcc-hover-gradient:hover .ngcc-border-frame { opacity: 0; }

.ngcc-hover-solid .ngcc-glow { background: var(--ngcc-color-a, #00f3ff); }
.ngcc-hover-solid:hover .ngcc-glow { opacity: 0.75; }
.ngcc-hover-solid:hover .ngcc-border-frame { opacity: 0; }

.ngcc-hover-glow-only .ngcc-glow { display: none; }
.ngcc-hover-glow-only:hover .ngcc-border-frame {
  background: color-mix(in srgb, var(--ngcc-color-a, #00f3ff) 45%, transparent);
}
.ngcc-hover-glow-only:hover .ngcc-card {
  box-shadow:
    0 0 var(--ngcc-glow-size, 15px) color-mix(in srgb, var(--ngcc-color-a, #00f3ff) 65%, transparent),
    inset 0 0 calc(var(--ngcc-glow-size, 15px) * 0.6) color-mix(in srgb, var(--ngcc-color-a, #00f3ff) 20%, transparent);
}

@keyframes ngcc-pulse {
  0%, 100% {
    box-shadow:
      0 0 var(--ngcc-glow-size, 15px) color-mix(in srgb, var(--ngcc-color-a, #00f3ff) 55%, transparent),
      inset 0 0 var(--ngcc-glow-size, 15px) color-mix(in srgb, var(--ngcc-color-a, #00f3ff) 15%, transparent);
  }
  50% {
    box-shadow:
      0 0 calc(var(--ngcc-glow-size, 15px) * 2.2) var(--ngcc-color-a, #00f3ff),
      inset 0 0 calc(var(--ngcc-glow-size, 15px) * 1.3) color-mix(in srgb, var(--ngcc-color-a, #00f3ff) 35%, transparent);
  }
}

.ngcc-hover-pulse .ngcc-glow { display: none; }
.ngcc-hover-pulse:hover .ngcc-border-frame {
  background: color-mix(in srgb, var(--ngcc-color-a, #00f3ff) 40%, transparent);
}
.ngcc-hover-pulse:hover .ngcc-card { animation: ngcc-pulse 1.4s ease-in-out infinite; }

@keyframes ngcc-border-sweep {
  0% { opacity: 0.7; filter: blur(var(--ngcc-glow-blur, 7px)) hue-rotate(0deg); }
  50% { opacity: 1; filter: blur(calc(var(--ngcc-glow-blur, 7px) * 0.5)) hue-rotate(30deg); }
  100% { opacity: 0.7; filter: blur(var(--ngcc-glow-blur, 7px)) hue-rotate(0deg); }
}

.ngcc-hover-trace:hover .ngcc-glow {
  opacity: 1;
  animation: ngcc-border-sweep 2s linear infinite;
}
.ngcc-hover-trace:hover .ngcc-border-frame { opacity: 0; }

.ngcc-hover-none .ngcc-glow { display: none; }

.ngcc-wrapper:hover .ngcc-icon-box {
  border-color: var(--ngcc-color-a, #00f3ff);
  box-shadow:
    0 0 var(--ngcc-glow-size, 15px) color-mix(in srgb, var(--ngcc-color-a, #00f3ff) 40%, transparent),
    inset 0 0 calc(var(--ngcc-glow-size, 15px) * 0.5) color-mix(in srgb, var(--ngcc-color-a, #00f3ff) 20%, transparent);
}

.ngcc-wrapper:hover .ngcc-icon { color: var(--ngcc-color-a, #00f3ff); }

.ngcc-wrapper:hover .ngcc-title {
  text-shadow:
    0 0 10px var(--ngcc-color-a, #00f3ff),
    0 0 20px var(--ngcc-color-a, #00f3ff);
}
`;
