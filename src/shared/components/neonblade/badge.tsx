import type { Child, FC } from "hono/jsx";

type BadgeColor = "cyan" | "pink" | "green" | (string & {});
type BadgeSize = "xs" | "sm" | "md";
type BadgeVariant = "solid" | "outline" | "ghost";
type BadgeShape = "pill" | "rectangle" | "corner-cut";
type BadgeCorner =
	| "bottom-right"
	| "bottom-left"
	| "top-right"
	| "top-left"
	| "all";

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
};

const CORNER_CLIP: Record<BadgeCorner, string> = {
	"bottom-right": "bdg-clip-br",
	"bottom-left": "bdg-clip-bl",
	"top-right": "bdg-clip-tr",
	"top-left": "bdg-clip-tl",
	all: "bdg-clip-all",
};

const INNER_SIZE: Record<BadgeSize, string> = {
	xs: "px-2 py-0.5 text-[9px] gap-1",
	sm: "px-2.5 py-1 text-[10px] gap-[5px]",
	md: "px-3.5 py-[5px] text-[11px] gap-[6px]",
};

type BadgeDot = "none" | "solid" | "pulse" | "flicker";

type BadgeProps = {
	children?: Child;
	color?: BadgeColor;
	variant?: BadgeVariant;
	shape?: BadgeShape;
	corner?: BadgeCorner;
	cornerSize?: number;
	dot?: BadgeDot;
	glow?: boolean;
	size?: BadgeSize;
	className?: string;
};

export const Badge: FC<BadgeProps> = ({
	children,
	color = "cyan",
	variant = "outline",
	shape = "pill",
	corner = "bottom-right",
	cornerSize = 8,
	dot = "none",
	glow = false,
	size = "sm",
	className = "",
}) => {
	const resolvedColor = COLOR_PRESETS[color] ?? color;
	const clipClass = shape === "corner-cut" ? CORNER_CLIP[corner] : "";
	const roundedClass = shape === "pill" ? "rounded-full" : "";

	const frameClass = [
		"absolute inset-0 pointer-events-none z-0",
		roundedClass,
		clipClass,
		variant === "outline" ? "bg-[var(--bdg-color)]" : "bg-white/[0.08]",
	]
		.filter(Boolean)
		.join(" ");

	const innerClass = [
		"relative z-[1] inline-flex items-center font-bold tracking-[0.1em] uppercase whitespace-nowrap select-none leading-none",
		INNER_SIZE[size],
		roundedClass,
		clipClass,
		variant === "solid" ? "bg-[var(--bdg-color)] text-black" : "",
		variant === "outline" ? "bg-black text-[var(--bdg-color)]" : "",
		variant === "ghost" ? "text-[var(--bdg-color)]" : "",
		glow ? "bdg-glow" : "",
	]
		.filter(Boolean)
		.join(" ");

	const ghostStyle =
		variant === "ghost"
			? "background-color:color-mix(in srgb, var(--bdg-color) 12%, #000)"
			: undefined;

	const wrapperStyle = `--bdg-color:${resolvedColor};--bdg-corner-size:${cornerSize}px`;

	return (
		<span
			class={`relative inline-flex p-px align-middle ${roundedClass} ${className}`}
			style={wrapperStyle}
		>
			<span class={frameClass} aria-hidden="true" />
			<span class={innerClass} style={ghostStyle}>
				{dot !== "none" && (
					<span
						class={`bdg-dot${dot !== "solid" ? ` bdg-dot-${dot}` : ""}`}
						style={`background:var(--bdg-color)`}
						aria-hidden="true"
					/>
				)}
				{children}
			</span>
		</span>
	);
};

export const badgeCss = `
.bdg-clip-br { clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--bdg-corner-size, 8px)), calc(100% - var(--bdg-corner-size, 8px)) 100%, 0 100%); }
.bdg-clip-bl { clip-path: polygon(0 0, 100% 0, 100% 100%, var(--bdg-corner-size, 8px) 100%, 0 calc(100% - var(--bdg-corner-size, 8px))); }
.bdg-clip-tr { clip-path: polygon(0 0, calc(100% - var(--bdg-corner-size, 8px)) 0, 100% var(--bdg-corner-size, 8px), 100% 100%, 0 100%); }
.bdg-clip-tl { clip-path: polygon(var(--bdg-corner-size, 8px) 0, 100% 0, 100% 100%, 0 100%, 0 var(--bdg-corner-size, 8px)); }
.bdg-clip-all { clip-path: polygon(var(--bdg-corner-size, 8px) 0, 100% 0, 100% calc(100% - var(--bdg-corner-size, 8px)), calc(100% - var(--bdg-corner-size, 8px)) 100%, 0 100%, 0 var(--bdg-corner-size, 8px)); }
.bdg-glow { box-shadow: 0 0 12px color-mix(in srgb, var(--bdg-color) 65%, transparent); text-shadow: 0 0 6px color-mix(in srgb, var(--bdg-color) 80%, transparent); }
.bdg-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; box-shadow: 0 0 6px color-mix(in srgb, var(--bdg-color) 90%, transparent); flex-shrink: 0; }
@keyframes bdg-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.25; transform: scale(0.75); } }
@keyframes bdg-flicker { 0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 1; } 20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.15; } }
.bdg-dot-pulse { animation: bdg-pulse 1.3s ease-in-out infinite !important; }
.bdg-dot-flicker { animation: bdg-flicker 0.45s linear infinite !important; }
`;
