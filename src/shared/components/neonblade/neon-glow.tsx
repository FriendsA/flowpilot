import type { Child } from "hono/jsx";

type NGColor =
	| "cyan"
	| "pink"
	| "green"
	| "purple"
	| "orange"
	| "yellow"
	| (string & {});

type NGGradientDirection =
	| "left-right"
	| "right-left"
	| "top-bottom"
	| "bottom-top"
	| "diagonal-tl-br"
	| "diagonal-tr-bl"
	| "radial"
	| "conic";

type NGGlowIntensity = "none" | "subtle" | "normal" | "strong" | "intense";
type NGAnimationType = "auto" | "shift" | "pulse";
type NGAnimationSpeed = "slow" | "normal" | "fast";

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
	purple: "#bf00ff",
	orange: "#ff6600",
	yellow: "#ffe000",
};

function resolveColor(color: NGColor): string {
	return COLOR_PRESETS[color as string] ?? color;
}

const LINEAR_ANGLES: Record<string, string> = {
	"left-right": "90deg",
	"right-left": "270deg",
	"top-bottom": "180deg",
	"bottom-top": "0deg",
	"diagonal-tl-br": "135deg",
	"diagonal-tr-bl": "45deg",
};

function buildSingleGlow(color: string, intensity: NGGlowIntensity): string {
	switch (intensity) {
		case "none":
			return "";
		case "subtle":
			return `0 0 5px ${color}99`;
		case "normal":
			return `0 0 6px ${color}, 0 0 14px ${color}66`;
		case "strong":
			return `0 0 8px ${color}, 0 0 20px ${color}, 0 0 40px ${color}55`;
		case "intense":
			return `0 0 10px ${color}, 0 0 20px ${color}, 0 0 40px ${color}, 0 0 80px ${color}44`;
		default:
			return "";
	}
}

function buildGradientGlowFilter(
	colors: string[],
	intensity: NGGlowIntensity,
): string {
	if (intensity === "none") return "";
	const perColor: Record<NGGlowIntensity, (c: string) => string> = {
		none: () => "",
		subtle: (c) => `drop-shadow(0 0 4px ${c}88)`,
		normal: (c) => `drop-shadow(0 0 6px ${c}99) drop-shadow(0 0 14px ${c}44)`,
		strong: (c) => `drop-shadow(0 0 8px ${c}) drop-shadow(0 0 20px ${c}66)`,
		intense: (c) =>
			`drop-shadow(0 0 12px ${c}) drop-shadow(0 0 28px ${c}77) drop-shadow(0 0 48px ${c}33)`,
	};
	return colors.map(perColor[intensity]).join(" ");
}

type NeonGlowProps = {
	children: Child;
	colors?: NGColor | NGColor[];
	gradientDirection?: NGGradientDirection;
	glowIntensity?: NGGlowIntensity;
	glowColor?: NGColor;
	gradientGlow?: boolean;
	animate?: boolean;
	animationType?: NGAnimationType;
	animationSpeed?: NGAnimationSpeed;
	className?: string;
};

export function NeonGlow({
	children,
	colors = "cyan",
	gradientDirection = "left-right",
	glowIntensity = "normal",
	glowColor,
	gradientGlow = false,
	animate = false,
	animationType = "auto",
	animationSpeed = "normal",
	className,
}: NeonGlowProps) {
	const colorArray = (Array.isArray(colors) ? colors : [colors]).slice(0, 4);
	const resolvedColors = colorArray.map(resolveColor);
	const isMultiColor = resolvedColors.length > 1;
	const primaryColor = resolvedColors[0] ?? resolveColor("cyan");
	const isLinearGradient =
		isMultiColor && !["radial", "conic"].includes(gradientDirection);

	const resolvedAnimType: "shift" | "pulse" =
		animationType === "auto"
			? isLinearGradient
				? "shift"
				: "pulse"
			: animationType;

	const styleEntries: string[] = [];

	if (isMultiColor) {
		if (gradientDirection === "radial") {
			styleEntries.push(
				`background-image:radial-gradient(ellipse at center, ${resolvedColors.join(", ")})`,
			);
		} else if (gradientDirection === "conic") {
			styleEntries.push(
				`background-image:conic-gradient(from 0deg, ${resolvedColors.join(", ")}, ${resolvedColors[0]})`,
			);
		} else {
			const angle = LINEAR_ANGLES[gradientDirection] ?? "90deg";
			if (animate && resolvedAnimType === "shift") {
				const extended = [
					...resolvedColors,
					...resolvedColors.slice().reverse(),
					resolvedColors[0],
				];
				styleEntries.push(
					`background-image:linear-gradient(${angle}, ${extended.join(", ")})`,
				);
				styleEntries.push("background-size:300% 300%");
			} else {
				styleEntries.push(
					`background-image:linear-gradient(${angle}, ${resolvedColors.join(", ")})`,
				);
			}
		}

		styleEntries.push("-webkit-background-clip:text");
		styleEntries.push("background-clip:text");
		styleEntries.push("-webkit-text-fill-color:transparent");
		styleEntries.push("color:transparent");

		if (gradientGlow && glowIntensity !== "none") {
			styleEntries.push(
				`filter:${buildGradientGlowFilter(resolvedColors, glowIntensity)}`,
			);
		} else if (glowColor) {
			const singleGlow = buildSingleGlow(
				resolveColor(glowColor),
				glowIntensity,
			);
			if (singleGlow) {
				const filterVal = singleGlow
					.split(", ")
					.map((s) => `drop-shadow(${s})`)
					.join(" ");
				styleEntries.push(`filter:${filterVal}`);
			}
		}
	} else {
		styleEntries.push(`color:${primaryColor}`);
		const glow = buildSingleGlow(
			glowColor ? resolveColor(glowColor) : primaryColor,
			glowIntensity,
		);
		if (glow) styleEntries.push(`text-shadow:${glow}`);
	}

	const animClasses: string[] = [];
	if (animate) {
		if (resolvedAnimType === "shift") {
			animClasses.push("ng-shift", `ng-shift--${animationSpeed}`);
		} else {
			animClasses.push("ng-pulse", `ng-pulse--${animationSpeed}`);
		}
	}

	const allClasses = [...animClasses, className].filter(Boolean).join(" ");

	return (
		<span class={allClasses} style={styleEntries.join(";")}>
			{children}
		</span>
	);
}

export const neonGlowCss = `
@keyframes ng-shift-kf {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.ng-shift {
  animation-name: ng-shift-kf;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
.ng-shift--slow { animation-duration: 6s; }
.ng-shift--normal { animation-duration: 3s; }
.ng-shift--fast { animation-duration: 1.5s; }

@keyframes ng-pulse-kf {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.ng-pulse {
  animation-name: ng-pulse-kf;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
.ng-pulse--slow { animation-duration: 4s; }
.ng-pulse--normal { animation-duration: 2s; }
.ng-pulse--fast { animation-duration: 1s; }
`;
