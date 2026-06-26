import type { Child, FC } from "hono/jsx";

type CCBColor = "cyan" | "pink" | "green" | (string & {});
type CCBSize = "xs" | "sm" | "md" | "lg" | "xl";
type CCBVariant = "solid" | "outline" | "ghost";
type CCBCorner =
	| "bottom-right"
	| "bottom-left"
	| "top-right"
	| "top-left"
	| "all";
type CCBHoverEffect =
	| "glow"
	| "shift"
	| "shine"
	| "pulse"
	| "scan"
	| "flicker"
	| "none";

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#00FF88",
};

const CORNER_CLASSES: Record<CCBCorner, string> = {
	"bottom-right": "ccb-clip-br",
	"bottom-left": "ccb-clip-bl",
	"top-right": "ccb-clip-tr",
	"top-left": "ccb-clip-tl",
	all: "ccb-clip-all",
};

const HOVER_CLASSES: Record<CCBHoverEffect, string> = {
	glow: "ccb-hover-glow",
	shift: "ccb-hover-shift",
	shine: "ccb-hover-shine",
	pulse: "ccb-hover-pulse",
	scan: "ccb-hover-scan",
	flicker: "ccb-hover-flicker",
	none: "",
};

const SIZE_CLASSES: Record<CCBSize, string> = {
	xs: "px-2.5 py-1 text-[11px] min-h-7",
	sm: "px-3.5 py-1.5 text-xs min-h-9",
	md: "px-5 py-2.5 text-[13px] min-h-11",
	lg: "px-6 py-3.5 text-sm min-h-13",
	xl: "px-8 py-4 text-base min-h-15",
};

const DEFAULT_CORNER_SIZE: Record<CCBSize, number> = {
	xs: 8,
	sm: 12,
	md: 16,
	lg: 20,
	xl: 24,
};

type CornerCutButtonProps = {
	children: Child;
	color?: CCBColor;
	size?: CCBSize;
	variant?: CCBVariant;
	corner?: CCBCorner;
	cornerSize?: number;
	hoverEffect?: CCBHoverEffect;
	onClick?: (e: MouseEvent) => void;
	disabled?: boolean;
	className?: string;
};

export const CornerCutButton: FC<CornerCutButtonProps> = ({
	children,
	color = "cyan",
	size = "md",
	variant = "solid",
	corner = "bottom-right",
	cornerSize,
	hoverEffect = "glow",
	onClick,
	disabled,
	className = "",
}) => {
	const resolvedCornerSize = cornerSize ?? DEFAULT_CORNER_SIZE[size];
	const resolvedColor = COLOR_PRESETS[color] ?? color;

	const wrapperClasses = [
		"relative inline-flex p-px",
		`ccb-wrapper-${hoverEffect}`,
		disabled ? "opacity-50 cursor-not-allowed" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	const wrapperStyle = [
		`--ccb-color:${resolvedColor}`,
		`--ccb-hover-color:${resolvedColor}`,
		`--ccb-hover-bg:#ffffff`,
		`--ccb-corner-size:${resolvedCornerSize}px`,
		`--ccb-glow-size:15px`,
	].join(";");

	const frameClasses = [
		"absolute inset-0 pointer-events-none ccb-frame",
		CORNER_CLASSES[corner],
		variant === "outline" ? "ccb-frame-outline" : "ccb-frame-bg",
	]
		.filter(Boolean)
		.join(" ");

	const btnClasses = [
		"flex-1 relative font-medium font-sans transition-all duration-150 overflow-hidden cursor-pointer border-none outline-none w-full",
		SIZE_CLASSES[size],
		CORNER_CLASSES[corner],
		HOVER_CLASSES[hoverEffect],
		`ccb-${variant}`,
		disabled ? "cursor-not-allowed" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div class={wrapperClasses} style={wrapperStyle}>
			<div class={frameClasses} aria-hidden="true" />
			<button
				class={btnClasses}
				type="button"
				{...(onClick ? { onClick } : {})}
				{...(disabled !== undefined ? { disabled } : {})}
			>
				{hoverEffect === "shine" && (
					<span class="ccb-shine-layer" aria-hidden="true" />
				)}
				{hoverEffect === "scan" && (
					<span class="ccb-scan-layer" aria-hidden="true" />
				)}
				<span class="relative z-10 flex items-center justify-center gap-1.5">
					{children}
				</span>
			</button>
		</div>
	);
};

export const cornerCutButtonCss = `
/* Clip-path corners */
.ccb-clip-br { clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--ccb-corner-size, 20px)), calc(100% - var(--ccb-corner-size, 20px)) 100%, 0 100%); }
.ccb-clip-bl { clip-path: polygon(0 0, 100% 0, 100% 100%, var(--ccb-corner-size, 20px) 100%, 0 calc(100% - var(--ccb-corner-size, 20px))); }
.ccb-clip-tr { clip-path: polygon(0 0, calc(100% - var(--ccb-corner-size, 20px)) 0, 100% var(--ccb-corner-size, 20px), 100% 100%, 0 100%); }
.ccb-clip-tl { clip-path: polygon(var(--ccb-corner-size, 20px) 0, 100% 0, 100% 100%, 0 100%, 0 var(--ccb-corner-size, 20px)); }
.ccb-clip-all { clip-path: polygon(var(--ccb-corner-size, 20px) 0, 100% 0, 100% calc(100% - var(--ccb-corner-size, 20px)), calc(100% - var(--ccb-corner-size, 20px)) 100%, 0 100%, 0 var(--ccb-corner-size, 20px)); }

/* Frame */
.ccb-frame-bg { background: rgba(255,255,255,0.08); }
.ccb-frame-outline { background: var(--ccb-color); }

/* Variants */
.ccb-solid { background: var(--ccb-color); color: #0A0A0F; }
.ccb-outline { background: #000; color: var(--ccb-color); }
.ccb-ghost { background: color-mix(in srgb, var(--ccb-color) 12%, #000); color: var(--ccb-color); }

/* Hover effects */
.ccb-wrapper-glow:hover { filter: drop-shadow(0 0 var(--ccb-glow-size, 15px) var(--ccb-hover-color)); }
.ccb-hover-glow:hover, .ccb-hover-default:hover { box-shadow: inset 0 0 calc(var(--ccb-glow-size, 15px) * 0.6) color-mix(in srgb, var(--ccb-hover-color) 25%, transparent); }
.ccb-solid.ccb-hover-glow:hover, .ccb-solid.ccb-hover-default:hover { background-color: var(--ccb-hover-color); }
.ccb-outline.ccb-hover-glow:hover, .ccb-outline.ccb-hover-default:hover { background-color: color-mix(in srgb, var(--ccb-hover-color) 15%, #000); }
.ccb-ghost.ccb-hover-glow:hover, .ccb-ghost.ccb-hover-default:hover { background-color: color-mix(in srgb, var(--ccb-hover-color) 22%, #000); }
.ccb-solid.ccb-hover-shift:hover { background-color: var(--ccb-hover-bg); color: #000000; }
.ccb-outline.ccb-hover-shift:hover { background-color: var(--ccb-hover-color); color: #000000; }
.ccb-ghost.ccb-hover-shift:hover { background-color: color-mix(in srgb, var(--ccb-hover-color) 28%, #000); box-shadow: inset 0 0 calc(var(--ccb-glow-size, 15px) * 0.6) color-mix(in srgb, var(--ccb-hover-color) 55%, transparent); }
@keyframes ccb-pulse-glow { 0%, 100% { box-shadow: inset 0 0 var(--ccb-glow-size, 15px) color-mix(in srgb, var(--ccb-hover-color) 20%, transparent); } 50% { box-shadow: inset 0 0 calc(var(--ccb-glow-size, 15px) * 1.5) color-mix(in srgb, var(--ccb-hover-color) 40%, transparent); } }
@keyframes ccb-pulse-glow-solid { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.3); } }
.ccb-hover-pulse:hover { animation: ccb-pulse-glow 1.2s ease-in-out infinite; }
.ccb-solid.ccb-hover-pulse:hover { background-color: var(--ccb-hover-color); animation: ccb-pulse-glow-solid 1.2s ease-in-out infinite; }
@keyframes ccb-shine-sweep { 0% { transform: translateX(-220%) skewX(-20deg); } 100% { transform: translateX(320%) skewX(-20deg); } }
.ccb-shine-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.ccb-shine-layer::after { content: ""; position: absolute; top: -10%; left: 0; width: 35%; height: 120%; background: linear-gradient(90deg, transparent, color-mix(in srgb, white 55%, transparent), transparent); transform: translateX(-220%) skewX(-20deg); }
.ccb-hover-shine:hover .ccb-shine-layer::after { animation: ccb-shine-sweep 0.65s ease forwards; }
@keyframes ccb-scan-line { 0% { top: -2px; opacity: 0.9; } 85% { opacity: 0.9; } 100% { top: calc(100% + 2px); opacity: 0; } }
.ccb-scan-layer { position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, color-mix(in srgb, white 85%, transparent), transparent); pointer-events: none; opacity: 0; top: -2px; z-index: 1; }
.ccb-hover-scan:hover .ccb-scan-layer { opacity: 1; animation: ccb-scan-line 1.1s linear infinite; }
@keyframes ccb-flicker { 0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 1; } 20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.35; } }
.ccb-wrapper:has(.ccb-hover-flicker:hover) { animation: ccb-flicker 0.45s linear infinite; }
`;
