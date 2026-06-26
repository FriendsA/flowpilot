import type { Child, FC } from "hono/jsx";

type AFColor = "cyan" | "pink" | "green" | (string & {});
type AFHoverEffect = "expand" | "glow" | "pulse" | "flicker" | "trace" | "none";
type AFGlowIntensity = "low" | "medium" | "high";
type AFBgVariant = "none" | "subtle" | "solid";
type AFCornerStyle = "square" | "rounded";

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
};

type AccentFrameProps = {
	children?: Child;
	text?: Child;
	color?: AFColor;
	colorB?: AFColor;
	cornerLength?: number;
	cornerThickness?: number;
	hoverLength?: number;
	transitionDuration?: number;
	cornerStyle?: AFCornerStyle;
	mode?: "duo" | "quad";
	hoverEffect?: AFHoverEffect;
	glowIntensity?: AFGlowIntensity;
	animated?: boolean;
	bgVariant?: AFBgVariant;
	className?: string;
	style?: string;
};

export const AccentFrame: FC<AccentFrameProps> = ({
	children,
	text,
	className = "",
	color = "cyan",
	colorB,
	cornerLength = 16,
	cornerThickness = 2,
	hoverLength = 32,
	transitionDuration = 300,
	cornerStyle = "square",
	mode = "duo",
	hoverEffect = "expand",
	glowIntensity = "medium",
	animated = false,
	bgVariant = "none",
	style,
}) => {
	const resolvedA = COLOR_PRESETS[color] ?? color;
	const resolvedB = colorB ? (COLOR_PRESETS[colorB] ?? colorB) : resolvedA;

	const wrapperClasses = [
		"px-6 py-4 relative group",
		hoverEffect !== "expand" && hoverEffect !== "none"
			? `af-hover-${hoverEffect}`
			: "",
		`af-glow-${glowIntensity}`,
		animated ? "af-animated" : "",
		bgVariant === "subtle" ? "af-bg-subtle" : "",
		bgVariant === "solid" ? "bg-[#0a0a0a]" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	const shouldExpand = hoverEffect === "expand";
	const off = `-${cornerThickness / 2}px`;

	const cornerBase = [
		"af-corner absolute",
		"transition-[width,height,box-shadow,opacity] duration-[var(--af-duration)]",
	].join(" ");

	const H = (pos: string, isB = false) =>
		[
			cornerBase,
			isB ? "af-corner-b" : "",
			pos,
			"h-[var(--af-thickness)] w-[var(--af-corner-length)]",
			shouldExpand ? "group-hover:w-[var(--af-hover-length)]" : "",
			isB
				? "bg-[var(--af-color-b,var(--af-color-a,#00f3ff))]"
				: "bg-[var(--af-color-a,#00f3ff)]",
			cornerStyle === "rounded" ? "rounded-[2px]" : "",
		]
			.filter(Boolean)
			.join(" ");

	const V = (pos: string, isB = false) =>
		[
			cornerBase,
			isB ? "af-corner-b" : "",
			pos,
			"w-[var(--af-thickness)] h-[var(--af-corner-length)]",
			shouldExpand ? "group-hover:h-[var(--af-hover-length)]" : "",
			isB
				? "bg-[var(--af-color-b,var(--af-color-a,#00f3ff))]"
				: "bg-[var(--af-color-a,#00f3ff)]",
			cornerStyle === "rounded" ? "rounded-[2px]" : "",
		]
			.filter(Boolean)
			.join(" ");

	const wrapperStyle = [
		`--af-color-a:${resolvedA}`,
		`--af-color-b:${resolvedB}`,
		`--af-corner-length:${cornerLength}px`,
		`--af-hover-length:${hoverLength}px`,
		`--af-thickness:${cornerThickness}px`,
		`--af-duration:${transitionDuration}ms`,
		style ?? "",
	]
		.filter(Boolean)
		.join(";");

	const offsetStyle = `margin-top:${off};margin-left:${off}`;
	const offsetStyleBR = `margin-bottom:${off};margin-right:${off}`;
	const offsetStyleTR = `margin-top:${off};margin-right:${off}`;
	const offsetStyleBL = `margin-bottom:${off};margin-left:${off}`;

	return (
		<div class={wrapperClasses} style={wrapperStyle}>
			<div class={H("top-0 left-0")} style={offsetStyle} />
			<div class={V("top-0 left-0")} style={offsetStyle} />

			<div class={H("bottom-0 right-0", true)} style={offsetStyleBR} />
			<div class={V("bottom-0 right-0", true)} style={offsetStyleBR} />

			{mode === "quad" && (
				<>
					<div class={H("top-0 right-0", true)} style={offsetStyleTR} />
					<div class={V("top-0 right-0", true)} style={offsetStyleTR} />

					<div class={H("bottom-0 left-0")} style={offsetStyleBL} />
					<div class={V("bottom-0 left-0")} style={offsetStyleBL} />
				</>
			)}

			<div class="relative z-10">{text ?? children}</div>
		</div>
	);
};

export const accentFrameCss = `
.af-glow-low { --af-glow-size: 5px; }
.af-glow-medium { --af-glow-size: 10px; }
.af-glow-high { --af-glow-size: 22px; }

.af-hover-glow:hover .af-corner {
  box-shadow:
    0 0 var(--af-glow-size, 10px) var(--af-color-a, #00f3ff),
    0 0 calc(var(--af-glow-size, 10px) * 2.2)
      color-mix(in srgb, var(--af-color-a, #00f3ff) 40%, transparent);
}

.af-hover-glow:hover .af-corner-b {
  box-shadow:
    0 0 var(--af-glow-size, 10px) var(--af-color-b, var(--af-color-a, #00f3ff)),
    0 0 calc(var(--af-glow-size, 10px) * 2.2)
      color-mix(in srgb, var(--af-color-b, var(--af-color-a, #00f3ff)) 40%, transparent);
}

@keyframes af-pulse-a {
  0%, 100% { box-shadow: 0 0 var(--af-glow-size, 10px) var(--af-color-a, #00f3ff); }
  50% {
    box-shadow:
      0 0 calc(var(--af-glow-size, 10px) * 2.5) var(--af-color-a, #00f3ff),
      0 0 calc(var(--af-glow-size, 10px) * 4.5)
        color-mix(in srgb, var(--af-color-a, #00f3ff) 30%, transparent);
  }
}

@keyframes af-pulse-b {
  0%, 100% { box-shadow: 0 0 var(--af-glow-size, 10px) var(--af-color-b, var(--af-color-a, #00f3ff)); }
  50% {
    box-shadow:
      0 0 calc(var(--af-glow-size, 10px) * 2.5) var(--af-color-b, var(--af-color-a, #00f3ff)),
      0 0 calc(var(--af-glow-size, 10px) * 4.5)
        color-mix(in srgb, var(--af-color-b, var(--af-color-a, #00f3ff)) 30%, transparent);
  }
}

.af-hover-pulse:hover .af-corner { animation: af-pulse-a 1.4s ease-in-out infinite; }
.af-hover-pulse:hover .af-corner-b { animation: af-pulse-b 1.4s ease-in-out infinite; }

@keyframes af-flicker {
  0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 1; }
  20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.12; }
}

.af-hover-flicker:hover .af-corner { animation: af-flicker 0.45s linear infinite; }

@keyframes af-trace-h {
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}

@keyframes af-trace-v {
  0% { background-position: 0 -100%; }
  100% { background-position: 0 200%; }
}

.af-hover-trace:hover .af-corner {
  background-size: 200% 200%;
  background-image: linear-gradient(
    90deg,
    var(--af-color-a, #00f3ff) 0%,
    color-mix(in srgb, white 70%, var(--af-color-a, #00f3ff)) 50%,
    var(--af-color-a, #00f3ff) 100%
  );
  animation: af-trace-h 1s linear infinite;
}

.af-animated.af-hover-glow .af-corner {
  box-shadow:
    0 0 var(--af-glow-size, 10px) var(--af-color-a, #00f3ff),
    0 0 calc(var(--af-glow-size, 10px) * 2.2)
      color-mix(in srgb, var(--af-color-a, #00f3ff) 40%, transparent);
}
.af-animated.af-hover-glow .af-corner-b {
  box-shadow:
    0 0 var(--af-glow-size, 10px) var(--af-color-b, var(--af-color-a, #00f3ff)),
    0 0 calc(var(--af-glow-size, 10px) * 2.2)
      color-mix(in srgb, var(--af-color-b, var(--af-color-a, #00f3ff)) 40%, transparent);
}

.af-animated.af-hover-pulse .af-corner { animation: af-pulse-a 1.4s ease-in-out infinite; }
.af-animated.af-hover-pulse .af-corner-b { animation: af-pulse-b 1.4s ease-in-out infinite; }
.af-animated.af-hover-flicker .af-corner { animation: af-flicker 0.45s linear infinite; }

.af-animated.af-hover-trace:hover .af-corner,
.af-animated.af-hover-trace .af-corner {
  background-size: 200% 200%;
  background-image: linear-gradient(
    90deg,
    var(--af-color-a, #00f3ff) 0%,
    color-mix(in srgb, white 70%, var(--af-color-a, #00f3ff)) 50%,
    var(--af-color-a, #00f3ff) 100%
  );
  animation: af-trace-h 1s linear infinite;
}

.af-bg-subtle {
  background-color: color-mix(in srgb, var(--af-color-a, #00f3ff) 6%, transparent);
}
`;
