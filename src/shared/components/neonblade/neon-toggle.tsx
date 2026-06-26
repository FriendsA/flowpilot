import type { FC } from "hono/jsx";
import { useState } from "hono/jsx";

type NTGColor = "cyan" | "pink" | "green" | (string & {});
type NTGSize = "sm" | "md" | "lg";

type NeonToggleProps = {
	checked?: boolean;
	defaultChecked?: boolean;
	onChange?: (checked: boolean) => void;
	color?: NTGColor;
	size?: NTGSize;
	disabled?: boolean;
	label?: string;
	labelPosition?: "left" | "right";
	className?: string;
	id?: string;
};

const PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
};
function resolveColor(c: NTGColor): string {
	return PRESETS[c] ?? c;
}

const TRACK_W: Record<NTGSize, number> = { sm: 38, md: 48, lg: 60 };
const TRACK_H: Record<NTGSize, number> = { sm: 22, md: 28, lg: 34 };
const THUMB_D: Record<NTGSize, number> = { sm: 14, md: 18, lg: 24 };
const THUMB_GAP: Record<NTGSize, number> = { sm: 4, md: 5, lg: 5 };

let _ntg = 0;

export const NeonToggle: FC<NeonToggleProps> = ({
	checked,
	defaultChecked = false,
	onChange,
	color = "cyan",
	size = "md",
	disabled = false,
	label,
	labelPosition = "right",
	className = "",
	id: idProp,
}) => {
	const autoId = `ntg-${++_ntg}`;
	const inputId = idProp ?? autoId;
	const accent = resolveColor(color);

	const [internalChecked, setInternalChecked] = useState(defaultChecked);
	const isChecked = checked !== undefined ? checked : internalChecked;

	const handleChange = (e: Event) => {
		if (disabled) return;
		const next = (e.target as HTMLInputElement).checked;
		if (checked === undefined) setInternalChecked(next);
		onChange?.(next);
	};

	const tw = TRACK_W[size];
	const th = TRACK_H[size];
	const td = THUMB_D[size];
	const gap = THUMB_GAP[size];
	const travel = tw - td - gap * 2;

	return (
		<label
			for={inputId}
			class={`ntg-label ntg-label-${labelPosition}${disabled ? " ntg-disabled" : ""} ${className}`}
			style={`--ntg-accent:${accent}`}
		>
			{label && labelPosition === "left" && (
				<span class="ntg-text">{label}</span>
			)}

			<input
				id={inputId}
				type="checkbox"
				role="switch"
				class="ntg-input"
				checked={isChecked}
				onChange={handleChange}
				disabled={disabled}
				aria-checked={isChecked}
			/>

			<span
				class={`ntg-track${isChecked ? " ntg-on" : ""}`}
				aria-hidden="true"
				style={`width:${tw}px;height:${th}px;border-radius:${th / 2}px`}
			>
				<span
					class="ntg-thumb"
					style={`width:${td}px;height:${td}px;left:${gap}px;transform:${isChecked ? `translate(${travel}px, -50%)` : "translate(0px, -50%)"}`}
				/>

				{isChecked && (
					<>
						<span class="ntg-spark ntg-spark-1" aria-hidden="true" />
						<span class="ntg-spark ntg-spark-2" aria-hidden="true" />
						<span class="ntg-spark ntg-spark-3" aria-hidden="true" />
					</>
				)}
			</span>

			{label && labelPosition === "right" && (
				<span class="ntg-text">{label}</span>
			)}
		</label>
	);
};

export const neonToggleCss = `
.ntg-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}
.ntg-label-right { flex-direction: row; }
.ntg-label-left  { flex-direction: row-reverse; }

.ntg-disabled {
  opacity: 0.38;
  cursor: not-allowed;
  pointer-events: none;
}

.ntg-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.ntg-track {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.13);
  transition:
    background 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;
  overflow: visible;
}

.ntg-track.ntg-on {
  background: color-mix(in srgb, var(--ntg-accent) 16%, transparent);
  border-color: color-mix(in srgb, var(--ntg-accent) 55%, transparent);
  box-shadow:
    0 0 12px color-mix(in srgb, var(--ntg-accent) 28%, transparent),
    inset 0 0 10px color-mix(in srgb, var(--ntg-accent) 10%, transparent);
}

.ntg-label:not(.ntg-disabled):hover .ntg-track {
  border-color: rgba(255, 255, 255, 0.22);
}
.ntg-label:not(.ntg-disabled):hover .ntg-track.ntg-on {
  box-shadow:
    0 0 18px color-mix(in srgb, var(--ntg-accent) 40%, transparent),
    inset 0 0 12px color-mix(in srgb, var(--ntg-accent) 14%, transparent);
}

.ntg-label:focus-within .ntg-track {
  outline: 2px solid var(--ntg-accent);
  outline-offset: 3px;
}

.ntg-thumb {
  position: absolute;
  top: 50%;
  border-radius: 50%;
  background: rgba(220, 230, 255, 0.65);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  transition:
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.22s ease,
    box-shadow 0.22s ease;
}

.ntg-on .ntg-thumb {
  background: var(--ntg-accent);
  box-shadow:
    0 0 8px var(--ntg-accent),
    0 0 20px color-mix(in srgb, var(--ntg-accent) 45%, transparent);
}

.ntg-label:not(.ntg-disabled):active .ntg-thumb {
  transform: scaleX(1.12) translateY(-50%) !important;
}

.ntg-spark {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ntg-accent);
  box-shadow: 0 0 5px var(--ntg-accent);
  pointer-events: none;
  animation: ntg-spark-fly 0.45s ease-out forwards;
}

.ntg-spark-1 { top: 35%; right: 28%; animation-delay: 0s;    --dx: -6px; --dy: -7px; }
.ntg-spark-2 { top: 55%; right: 22%; animation-delay: 0.07s; --dx: -4px; --dy:  5px; }
.ntg-spark-3 { top: 45%; right: 34%; animation-delay: 0.13s; --dx: -8px; --dy:  2px; }

@keyframes ntg-spark-fly {
  0%   { transform: translate(0, 0) scale(1);   opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
}

.ntg-text {
  font-family: var(--font-rajdhani, sans-serif);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.2s ease;
}
.ntg-label:not(.ntg-disabled):hover .ntg-text {
  color: rgba(255, 255, 255, 0.95);
}
`;
