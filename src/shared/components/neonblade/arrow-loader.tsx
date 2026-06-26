import type { FC } from "hono/jsx";

type ALColor = "cyan" | "pink" | "green" | (string & {});

type ArrowLoaderProps = {
	color?: ALColor;
	height?: number;
	arrowSize?: number;
	gap?: number;
	thickness?: number;
	speed?: number;
	trackColor?: string;
	className?: string;
};

const COLOR_PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
};
function resolveColor(c: ALColor): string {
	return COLOR_PRESETS[c] ?? c;
}

export const ArrowLoader: FC<ArrowLoaderProps> = ({
	color = "cyan",
	height = 8,
	arrowSize = 10,
	gap = 8,
	thickness = 2.5,
	speed = 450,
	trackColor = "rgba(255,255,255,0.06)",
	className = "",
}) => {
	const accent = resolveColor(color);
	const h = height;
	const tileSize = arrowSize + gap;

	const halfGap = gap / 2;
	const py0 = tileSize * 0.1;
	const pyMid = tileSize * 0.5;
	const py1 = tileSize * 0.9;
	const svgPath = `M${halfGap} ${py0} L${tileSize - halfGap} ${pyMid} L${halfGap} ${py1}`;
	const svgUrl = `url("data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns='http://www.w3.org/2000/svg' width='${tileSize}' height='${tileSize}' viewBox='0 0 ${tileSize} ${tileSize}'><path d='${svgPath}' stroke='${accent}' stroke-width='${thickness}' fill='none' stroke-linecap='butt' stroke-linejoin='miter'/></svg>`,
	)}")`;

	return (
		<div
			class={`al-wrapper ${className}`}
			role="progressbar"
			aria-label="Loading"
			aria-valuemin={0}
			aria-valuemax={100}
			style={`--al-tile:${tileSize}px;--al-speed:${speed}ms`}
		>
			<div class="al-track" style={`height:${h}px;background:${trackColor}`}>
				<div
					class="al-fill"
					style={`background-image:${svgUrl};background-size:${tileSize}px 100%`}
				/>
			</div>
		</div>
	);
};

export const arrowLoaderCss = `
.al-wrapper {
  position: relative;
  width: 100%;
}

.al-track {
  position: relative;
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  border-radius: 2px;
}

.al-fill {
  position: absolute;
  inset: 0;
  background-repeat: repeat-x;
  background-position: 0 center;
  animation: al-arrows var(--al-speed, 450ms) linear infinite;
}

@keyframes al-arrows {
  from {
    background-position: 0 center;
  }
  to {
    background-position: var(--al-tile, 18px) center;
  }
}
`;
