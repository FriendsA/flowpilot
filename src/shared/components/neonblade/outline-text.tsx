import { useEffect, useRef } from "hono/jsx";

type OTColor =
	| "cyan"
	| "pink"
	| "green"
	| "purple"
	| "orange"
	| "yellow"
	| (string & {});

type OTGlowIntensity = "none" | "subtle" | "normal" | "strong" | "intense";

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
	purple: "#bf00ff",
	orange: "#ff6600",
	yellow: "#ffe000",
};

function resolveColor(color: OTColor): string {
	return COLOR_PRESETS[color as string] ?? color;
}

function buildGlow(color: string, intensity: OTGlowIntensity): string {
	const c = resolveColor(color as OTColor);
	switch (intensity) {
		case "none":
			return "none";
		case "subtle":
			return `0 0 5px ${c}99`;
		case "normal":
			return `0 0 6px ${c}, 0 0 14px ${c}66`;
		case "strong":
			return `0 0 8px ${c}, 0 0 20px ${c}, 0 0 40px ${c}55`;
		case "intense":
			return `0 0 10px ${c}, 0 0 20px ${c}, 0 0 40px ${c}, 0 0 80px ${c}44`;
		default:
			return "none";
	}
}

type OutlineTextProps = {
	children: string;
	strokeColor?: OTColor;
	fillColor?: string;
	strokeWidth?: number;
	fontSize?: string | number;
	hoverStrokeColor?: OTColor;
	hoverFillColor?: string;
	hoverGlowIntensity?: OTGlowIntensity;
	hoverGlowColor?: OTColor;
	proximityRadius?: number;
	proximityEffect?: boolean;
	transitionDuration?: number;
	className?: string;
};

export function OutlineText({
	children,
	strokeColor = "cyan",
	fillColor = "transparent",
	strokeWidth = 1,
	fontSize = "3rem",
	hoverStrokeColor,
	hoverFillColor,
	hoverGlowIntensity = "normal",
	hoverGlowColor,
	proximityRadius = 100,
	proximityEffect = true,
	transitionDuration = 200,
	className = "",
}: OutlineTextProps) {
	const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

	const resolvedStroke = resolveColor(strokeColor);
	const resolvedHoverStroke = resolveColor(hoverStrokeColor ?? strokeColor);
	const resolvedFill = fillColor;
	const resolvedHoverFill = hoverFillColor ?? fillColor;
	const glowColorResolved = resolveColor(
		hoverGlowColor ?? hoverStrokeColor ?? strokeColor,
	);
	const glowValue = buildGlow(glowColorResolved, hoverGlowIntensity);

	const transition = `color ${transitionDuration}ms ease, -webkit-text-stroke-color ${transitionDuration}ms ease, text-shadow ${transitionDuration}ms ease`;

	const chars = children.split("");

	useEffect(() => {
		letterRefs.current = (letterRefs.current ?? []).slice(0, chars.length);
	}, [chars.length]);

	const applyDefault = (span: HTMLSpanElement) => {
		span.style.color = resolvedFill;
		span.style.webkitTextStrokeColor = resolvedStroke;
		span.style.textShadow = "none";
	};

	const applyActive = (span: HTMLSpanElement) => {
		span.style.color = resolvedHoverFill;
		span.style.webkitTextStrokeColor = resolvedHoverStroke;
		span.style.textShadow = glowValue;
	};

	useEffect(() => {
		letterRefs.current?.forEach((span) => {
			if (span) applyDefault(span);
		});
	}, [resolvedFill, resolvedStroke]);

	const handleMouseMove = (e: MouseEvent) => {
		if (!proximityEffect) return;
		const { clientX, clientY } = e;
		letterRefs.current?.forEach((span) => {
			if (!span) return;
			const rect = span.getBoundingClientRect();
			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;
			const dist = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
			if (dist <= proximityRadius) {
				applyActive(span);
			} else {
				applyDefault(span);
			}
		});
	};

	const handleMouseEnter = () => {
		if (proximityEffect) return;
		letterRefs.current?.forEach((span) => {
			if (span) applyActive(span);
		});
	};

	const handleMouseLeave = () => {
		letterRefs.current?.forEach((span) => {
			if (span) applyDefault(span);
		});
	};

	const fontSizeValue =
		typeof fontSize === "number" ? `${fontSize}px` : fontSize;

	return (
		<span
			class={className}
			style={`display:inline-block;font-size:${fontSizeValue};cursor:default`}
			onMouseMove={handleMouseMove}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{chars.map((char, i) => {
				const letterStyle = [
					"display:inline-block",
					`color:${resolvedFill}`,
					`-webkit-text-stroke:${strokeWidth}px ${resolvedStroke}`,
					"text-shadow:none",
					`transition:${transition}`,
					char === " " ? "white-space:pre" : "",
				]
					.filter(Boolean)
					.join(";");
				return (
					<span
						key={i}
						ref={(el: HTMLSpanElement | null) => {
							const refs = letterRefs.current;
							if (refs) refs[i] = el;
						}}
						style={letterStyle}
					>
						{char}
					</span>
				);
			})}
		</span>
	);
}
