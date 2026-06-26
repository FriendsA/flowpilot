// NeonSelect — ported from neonblade-ui reference implementation, hono/jsx adapted
// Adds searchable dropdown, generic items, custom renderItem/renderValue.

import type { Child } from "hono/jsx";
import { useEffect, useRef, useState } from "hono/jsx";
import { createPortal } from "hono/jsx/dom";
import { filterByRelevance } from "../../../utils/search";
import { NeonGlow } from "./neon-glow";
import { NeonInput } from "./neon-input";
import { ProgressBar } from "./progress-bar";

type NSLColor = "cyan" | "pink" | "green" | (string & {});
type NSLSize = "sm" | "md" | "lg";
type NSLVariant = "square" | "corner-cut";

type NSLItem = { name: string; [key: string]: unknown };

const PRESETS: Record<string, string> = {
	cyan: "#00f3ff",
	pink: "#ff00ff",
	green: "#39ff14",
};
function resolveColor(c: NSLColor): string {
	return PRESETS[c] ?? c;
}

const PADDING: Record<NSLSize, string> = {
	sm: "6px 10px",
	md: "9px 14px",
	lg: "12px 18px",
};
const FONT: Record<NSLSize, number> = { sm: 11, md: 13, lg: 15 };
const CUT: Record<NSLSize, number> = { sm: 6, md: 8, lg: 10 };
const LIST_CUT: Record<NSLSize, number> = { sm: 8, md: 10, lg: 12 };

let _nsid = 0;

type NeonSelectProps<T extends NSLItem = NSLItem> = {
	id?: string;
	label?: string;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyText?: string | undefined;
	items: T[];
	value: T | null | undefined;
	isEqual?: ((a: T, b: T) => boolean) | undefined;
	onSelect: (item: T) => void;
	onOpen?: (() => void) | undefined;
	renderItem?: ((item: T, isActive: boolean) => Child) | undefined;
	renderValue?: ((item: T) => string) | undefined;
	color?: NSLColor;
	size?: NSLSize;
	variant?: NSLVariant;
	disabled?: boolean;
	loading?: boolean;
	searchable?: boolean;
	className?: string;
	zIndex?: number | undefined;
	ariaLabel?: string;
};

export function NeonSelect<T extends NSLItem = NSLItem>({
	id: idProp,
	label,
	placeholder = "SELECT...",
	searchPlaceholder,
	emptyText,
	items,
	value,
	isEqual,
	onSelect,
	onOpen,
	renderItem,
	renderValue,
	color = "cyan",
	size = "md",
	variant = "square",
	disabled = false,
	loading = false,
	searchable = true,
	className = "",
	zIndex,
	ariaLabel,
}: NeonSelectProps<T>) {
	const [autoId] = useState(() => `nsl-${++_nsid}`);
	const compId = idProp ?? autoId;
	const listId = `${compId}-list`;
	const accent = resolveColor(color);
	const cut = CUT[size];
	const listCut = LIST_CUT[size];
	const cc = variant === "corner-cut";

	const [open, setOpenRaw] = useState(false);
	const [search, setSearch] = useState("");
	const [focusedIdx, setFocusedIdx] = useState(-1);
	const [floatTick, setFloatTick] = useState(0);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const triggerClip = `polygon(0 0, 100% 0, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, 0 100%)`;
	const listClip = `polygon(0 0, 100% 0, 100% calc(100% - ${listCut}px), calc(100% - ${listCut}px) 100%, 0 100%)`;

	const setOpen = (v: boolean) => {
		setOpenRaw(v);
		if (!v) {
			setSearch("");
			setFocusedIdx(-1);
		} else if (onOpen) {
			onOpen();
		}
	};

	const filtered = filterByRelevance(items, search);
	const eq = (a: T, b: T | null | undefined): boolean => {
		if (!b) return false;
		return isEqual ? isEqual(a, b) : a.name === b.name;
	};

	const selectItem = (item: T) => {
		if (disabled) return;
		onSelect(item);
		setOpen(false);
		triggerRef.current?.focus();
	};

	const floatStyle = (() => {
		void floatTick;
		const el = triggerRef.current;
		if (!el) return "";
		const r = el.getBoundingClientRect();
		return `position:fixed;top:${r.bottom + 4}px;left:${r.left}px;width:${r.width}px;z-index:9999`;
	})();

	useEffect(() => {
		if (!open) return;
		const onLayout = () => setFloatTick((n) => n + 1);
		window.addEventListener("scroll", onLayout, true);
		window.addEventListener("resize", onLayout);
		return () => {
			window.removeEventListener("scroll", onLayout, true);
			window.removeEventListener("resize", onLayout);
		};
	}, [open]);

	useEffect(() => {
		const handler = (e: Event) => {
			const target = e.target as Node;
			const inside =
				wrapperRef.current?.contains(target) ||
				listRef.current?.contains(target);
			if (!inside) setOpen(false);
		};
		if (open) document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	const handleKeyDown = (e: KeyboardEvent) => {
		if (disabled || loading) return;
		switch (e.key) {
			case "Enter":
			case " ": {
				e.preventDefault();
				if (open && focusedIdx >= 0 && filtered[focusedIdx]) {
					selectItem(filtered[focusedIdx]);
				} else {
					setOpen(!open);
				}
				break;
			}
			case "Escape":
				e.preventDefault();
				setOpen(false);
				triggerRef.current?.focus();
				break;
			case "ArrowDown": {
				e.preventDefault();
				if (!open) {
					setOpen(true);
					setFocusedIdx(0);
				} else {
					setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1));
				}
				break;
			}
			case "ArrowUp": {
				e.preventDefault();
				setFocusedIdx((i) => Math.max(i - 1, 0));
				break;
			}
			case "Tab":
				setOpen(false);
				break;
		}
	};

	const triggerBtn = (
		<button
			ref={triggerRef}
			id={compId}
			type="button"
			class={`nsl-trigger${open ? " nsl-trigger-open" : ""}${cc ? " nsl-trigger-cc" : ""}${loading ? " nsl-loading" : ""}`}
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-controls={listId}
			aria-busy={loading || undefined}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={() => {
				if (!disabled && !loading) {
					setOpen(!open);
				}
			}}
			onKeyDown={handleKeyDown}
			style={`padding:${PADDING[size]};font-size:${FONT[size]}px${cc ? `;clip-path:${triggerClip}` : ""}`}
		>
			<span
				class={`nsl-value${!value && !loading ? " nsl-placeholder" : ""}`}
				style={`font-size:${FONT[size]}px${loading ? ";flex:1;min-width:0" : ""}`}
			>
				{loading ? (
					<ProgressBar
						value={100}
						variant="striped"
						color={accent}
						size="sm"
						glow
					/>
				) : value ? (
					renderValue ? (
						renderValue(value)
					) : (
						value.name
					)
				) : (
					placeholder
				)}
			</span>
			<span class="nsl-arrow" aria-hidden="true">
				▼
			</span>
		</button>
	);

	const renderOptions = filtered.map((item, i) => {
		const isSelected = eq(item, value);
		const isFocused = i === focusedIdx;
		return (
			<div
				key={i}
				tabIndex={-1}
				class={`nsl-option${isSelected ? " nsl-selected" : ""}${isFocused ? " nsl-focused" : ""}`}
				style={`font-size:${FONT[size]}px;padding:${PADDING[size]}`}
				onClick={() => selectItem(item)}
				onMouseEnter={() => setFocusedIdx(i)}
			>
				{renderItem ? (
					renderItem(item, isSelected)
				) : (
					<>
						{isSelected && (
							<span class="nsl-check" aria-hidden="true">
								✓
							</span>
						)}
						<span>{item.name}</span>
					</>
				)}
			</div>
		);
	});

	const dropdownBody = (
		<div
			ref={listRef}
			id={listId}
			class={`nsl-list${cc ? " nsl-list-cc" : ""}`}
			style={cc ? `clip-path:${listClip}` : floatStyle}
			onKeyDown={handleKeyDown}
		>
			{searchable && (
				<div class="nsl-search">
					<NeonInput
						color={accent}
						size="sm"
						variant="filled"
						borderStyle="bottom"
						placeholder={searchPlaceholder ?? label ?? placeholder}
						value={search}
						autoFocus
						onInput={(e: Event) =>
							setSearch((e.target as HTMLInputElement).value)
						}
					/>
				</div>
			)}
			{filtered.length > 0 ? (
				renderOptions
			) : (
				<div class="nsl-empty">{emptyText ?? placeholder}</div>
			)}
		</div>
	);

	return (
		<div
			ref={wrapperRef}
			class={`nsl-wrapper${disabled ? " nsl-disabled" : ""}${open ? " nsl-open" : ""} ${className}`}
			style={`--nsl-accent:${accent};z-index:${open ? (zIndex ?? 100) : 1}`}
		>
			{label && (
				<span class="nsl-label" style={`font-size:${FONT[size] - 2}px`}>
					<NeonGlow colors={accent} glowIntensity="subtle">
						{label}
					</NeonGlow>
				</span>
			)}
			{cc ? (
				<div
					class={`nsl-frame${open ? " nsl-frame-open" : ""}`}
					style={`clip-path:${triggerClip}`}
				>
					{triggerBtn}
				</div>
			) : (
				triggerBtn
			)}
			{open &&
				createPortal(
					cc ? (
						<div
							class="nsl-list-frame"
							style={`${floatStyle};clip-path:${listClip}`}
						>
							{dropdownBody}
						</div>
					) : (
						dropdownBody
					),
					document.body,
				)}
		</div>
	);
}

export const neonSelectCss = `
/* NeonSelect CSS — ported from neonblade-ui reference + search additions */
.nsl-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
  font-family: var(--sans);
  margin-bottom: 16px;
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
}
.nsl-disabled { opacity: 0.4; pointer-events: none; }
.nsl-loading { cursor: default; }
.nsl-loading .nsl-arrow { opacity: 0.3; }
.nsl-loading:hover .nsl-trigger,
.nsl-loading .nsl-trigger:hover { border-color: var(--border); }

.nsl-label {
  display: block;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: color-mix(in srgb, var(--nsl-accent) 70%, rgba(255,255,255,0.5));
  margin-bottom: 6px;
  text-transform: uppercase;
}

/* Trigger */
.nsl-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-1);
  font-weight: 500;
  letter-spacing: 0.04em;
  cursor: pointer;
  text-align: left;
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.nsl-trigger:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--nsl-accent) 50%, transparent);
  background: color-mix(in srgb, var(--nsl-accent) 5%, transparent);
}
.nsl-trigger.nsl-trigger-open {
  border-color: var(--nsl-accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--nsl-accent) 25%, transparent),
              inset 0 0 8px color-mix(in srgb, var(--nsl-accent) 6%, transparent);
}
.nsl-trigger:focus-visible {
  outline: 2px solid var(--nsl-accent);
  outline-offset: 2px;
}

/* Corner-cut frame */
.nsl-frame {
  width: 100%;
  background: rgba(255, 255, 255, 0.18);
  padding: 1px;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}
.nsl-frame:hover:not(.nsl-disabled .nsl-frame) {
  background: rgba(255, 255, 255, 0.32);
}
.nsl-frame.nsl-frame-open {
  background: var(--nsl-accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--nsl-accent) 35%, transparent);
}
.nsl-trigger-cc {
  border: none !important;
  box-shadow: none !important;
  background: var(--bg-input) !important;
  outline-offset: 3px;
}
.nsl-trigger-cc:hover:not(:disabled) {
  background: color-mix(in srgb, var(--nsl-accent) 5%, var(--bg-input)) !important;
  border: none !important;
}

.nsl-placeholder {
  color: var(--text-3);
  font-weight: 300;
}

.nsl-arrow {
  color: var(--nsl-accent);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: transform 0.2s ease, opacity 0.2s ease, filter 0.2s ease;
  opacity: 0.65;
}
.nsl-open .nsl-arrow {
  transform: rotate(180deg);
  opacity: 1;
  filter: drop-shadow(0 0 4px var(--nsl-accent));
}

/* Dropdown (square) */
.nsl-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--bg-card);
  border: 1px solid color-mix(in srgb, var(--nsl-accent) 35%, transparent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--nsl-accent) 15%, transparent),
              0 8px 24px rgba(0, 0, 0, 0.6);
  animation: nsl-open-in 0.12s ease-out;
  backdrop-filter: blur(8px);
  max-height: 280px;
  overflow-y: auto;
}
.nsl-list::-webkit-scrollbar { width: 6px; }
.nsl-list::-webkit-scrollbar-track { background: transparent; }
.nsl-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* Corner-cut dropdown frame */
.nsl-list-frame {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--nsl-accent) 35%, transparent);
  padding: 1px;
  box-shadow: 0 0 20px color-mix(in srgb, var(--nsl-accent) 15%, transparent),
              0 8px 24px rgba(0, 0, 0, 0.6);
  animation: nsl-open-in 0.12s ease-out;
  max-height: 280px;
  overflow: hidden;
}
.nsl-list-cc {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--bg-card);
  border: none;
  backdrop-filter: blur(8px);
  max-height: 278px;
  overflow-y: auto;
}
.nsl-list-cc::-webkit-scrollbar { width: 6px; }
.nsl-list-cc::-webkit-scrollbar-track { background: transparent; }
.nsl-list-cc::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

@keyframes nsl-open-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Search input inside dropdown */
.nsl-search {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg-card);
  z-index: 1;
}

/* Options */
.nsl-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: var(--text-1);
  cursor: pointer;
  transition: background 0.1s ease, color 0.1s ease;
}
.nsl-option:hover,
.nsl-option.nsl-focused {
  background: color-mix(in srgb, var(--nsl-accent) 12%, transparent);
  color: var(--text-1);
}
.nsl-option.nsl-selected {
  color: var(--nsl-accent);
  background: color-mix(in srgb, var(--nsl-accent) 10%, transparent);
  font-weight: 500;
}
.nsl-option-disabled { opacity: 0.35; cursor: not-allowed; }
.nsl-check {
  font-size: 10px;
  color: var(--nsl-accent);
  filter: drop-shadow(0 0 3px var(--nsl-accent));
  min-width: 12px;
}

/* Rich item content (used by renderItem across pages) */
.sel-item-name { font-weight: 500; color: var(--text-1); }
.sel-item-sub { font-size: 11px; color: var(--text-3); font-family: var(--mono); margin-top: 2px; }
.nsl-empty {
  padding: 12px;
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
  list-style: none;
}
`;
