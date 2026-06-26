import type { FC } from "hono/jsx";

type PBColor = "cyan" | "pink" | "green" | (string & {});
type PBVariant = "solid" | "segmented" | "striped" | "pulse";
type PBSize = "xs" | "sm" | "md" | "lg";

type ProgressBarProps = {
	value: number;
	max?: number;
	color?: PBColor;
	variant?: PBVariant;
	size?: PBSize;
	showLabel?: boolean;
	label?: string;
	glow?: boolean;
	pulse?: boolean;
	className?: string;
};

const PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
};
function resolveColor(c: PBColor): string {
	return PRESETS[c] ?? c;
}

const SIZE_H: Record<PBSize, number> = { xs: 3, sm: 5, md: 8, lg: 12 };

export const ProgressBar: FC<ProgressBarProps> = ({
	value,
	max = 100,
	color = "cyan",
	variant = "solid",
	size = "md",
	showLabel = false,
	label,
	glow = true,
	pulse = false,
	className = "",
}) => {
	const accent = resolveColor(color);
	const pct = Math.min(100, Math.max(0, (value / max) * 100));
	const displayLabel = label ?? `${Math.round(pct)}%`;
	const h = SIZE_H[size];

	const fillClass =
		variant === "striped" && pulse
			? "pb-fill pb-variant-striped-pulse"
			: `pb-fill pb-variant-${variant}${glow && variant !== "pulse" ? " pb-glow" : ""}`;

	return (
		<div class={`pb-wrapper ${className}`} style={`--pb-accent:${accent}`}>
			{showLabel && (
				<div class="pb-label-row">
					<span class="pb-label-text">{displayLabel}</span>
				</div>
			)}

			<div
				class="pb-track"
				style={`height:${h}px`}
				role="progressbar"
				aria-valuenow={value}
				aria-valuemin={0}
				aria-valuemax={max}
				aria-label={displayLabel}
			>
				<div class={fillClass} style={`width:${pct}%`} />

				{variant === "segmented" && (
					<div class="pb-segments" aria-hidden="true">
						{Array.from({ length: 9 }).map((_, i) => (
							<div
								key={i}
								class="pb-segment-divider"
								style={`left:${(i + 1) * 10}%`}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export const progressBarCss = `
.pb-wrapper {
  position: relative;
  width: 100%;
}

.pb-label-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 5px;
}

.pb-label-text {
  font-family: var(--font-orbitron, monospace);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--pb-accent);
  filter: drop-shadow(0 0 4px var(--pb-accent));
}

/* Track */
.pb-track {
  position: relative;
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  border-radius: 2px;
}

/* Fill bar */
.pb-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Solid */
.pb-variant-solid {
  background: var(--pb-accent);
  border-radius: 2px;
}

/* Glow */
.pb-glow {
  box-shadow:
    0 0 6px var(--pb-accent),
    0 0 12px color-mix(in srgb, var(--pb-accent) 50%, transparent);
}

/* Striped */
.pb-variant-striped {
  background: repeating-linear-gradient(
    45deg,
    var(--pb-accent),
    var(--pb-accent) 6px,
    color-mix(in srgb, var(--pb-accent) 60%, transparent) 6px,
    color-mix(in srgb, var(--pb-accent) 60%, transparent) 12px
  );
  background-size: 17px 100%;
  border-radius: 2px;
  animation: pb-stripes 0.6s linear infinite;
}

/* Striped + Pulse (combined) */
.pb-variant-striped-pulse {
  background: repeating-linear-gradient(
    45deg,
    var(--pb-accent),
    var(--pb-accent) 6px,
    color-mix(in srgb, var(--pb-accent) 60%, transparent) 6px,
    color-mix(in srgb, var(--pb-accent) 60%, transparent) 12px
  );
  background-size: 17px 100%;
  border-radius: 2px;
  animation: pb-stripes 0.6s linear infinite, pb-pulse 1.5s ease-in-out infinite;
}

@keyframes pb-stripes {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 17px 0;
  }
}

/* Pulse */
.pb-variant-pulse {
  background: var(--pb-accent);
  border-radius: 2px;
  animation: pb-pulse 1.5s ease-in-out infinite;
}

@keyframes pb-pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 6px var(--pb-accent);
  }
  50% {
    opacity: 0.7;
    box-shadow:
      0 0 14px var(--pb-accent),
      0 0 28px color-mix(in srgb, var(--pb-accent) 40%, transparent);
  }
}

/* Segmented fill */
.pb-variant-segmented {
  background: var(--pb-accent);
  border-radius: 2px;
}

/* Segment dividers overlay */
.pb-segments {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pb-segment-divider {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100%;
  background: rgba(4, 4, 10, 0.6);
}
`;
