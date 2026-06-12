// Shared searchable select/dropdown CSS + helpers + component for release/end/mr Web UI

export const selKeyDown = (
	e: KeyboardEvent,
	open: boolean,
	len: number,
	idx: number,
	onSelect: (i: number) => void,
	onClose: () => void,
): number | undefined => {
	if (!open || len === 0) return undefined;
	switch (e.key) {
		case "ArrowDown":
			e.preventDefault();
			return Math.min(idx + 1, len - 1);
		case "ArrowUp":
			e.preventDefault();
			return Math.max(idx - 1, -1);
		case "Enter":
			e.preventDefault();
			if (idx >= 0) onSelect(idx);
			return undefined;
		case "Escape":
			onClose();
			return undefined;
	}
	return undefined;
};

export const selectCss = `
/* ── Generic select ── */
.sel {
  position: relative;
  margin-bottom: 16px;
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
  z-index: 1;
}
.sel-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  font-size: 13px;
  font-family: var(--sans);
  color: var(--text-1);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  text-align: left;
}
.sel-trigger:hover { border-color: var(--border-active); }
.sel-trigger:focus,
.sel-trigger.open {
  border-color: var(--neon);
  box-shadow: 0 0 0 2px var(--neon-soft), 0 0 8px var(--neon-glow);
}
.sel-trigger-label {
  font-size: 11px;
  color: var(--text-3);
  flex-shrink: 0;
}
.sel-trigger-value {
  flex: 1;
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}
.sel-trigger-value.empty {
  color: var(--text-3);
  font-weight: 300;
}
.sel-trigger-arrow {
  color: var(--text-3);
  font-size: 10px;
  transition: transform 0.2s;
}
.sel-trigger.open .sel-trigger-arrow {
  transform: rotate(180deg);
}
.sel-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  max-height: 280px;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid rgba(0,255,136,0.08);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 12px rgba(0,255,136,0.03);
  z-index: 1000;
  animation: dropdown-in 0.12s ease both;
}
.sel-dropdown::-webkit-scrollbar { width: 6px; }
.sel-dropdown::-webkit-scrollbar-track { background: transparent; }
.sel-dropdown::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.sel-search {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg-card);
  z-index: 1;
}
.sel-search-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 12px;
  font-family: var(--mono);
  color: var(--text-1);
  background: var(--bg-void);
  border: 1px solid var(--border);
  border-radius: 4px;
  outline: none;
  transition: border-color 0.15s;
}
.sel-search-input::placeholder { color: var(--text-3); }
.sel-search-input:focus { border-color: var(--neon); }
.sel-item {
  padding: 10px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
  border-left: 3px solid transparent;
}
.sel-item:first-child { border-radius: 7px 7px 0 0; }
.sel-item:last-child { border-radius: 0 0 7px 7px; }
.sel-item:hover,
.sel-item.highlighted { background: var(--bg-hover); }
.sel-item.active {
  background: var(--neon-soft);
  border-left-color: var(--neon);
  font-weight: 500;
}
.sel-item-name { font-weight: 500; color: var(--text-1); }
.sel-item-sub { font-size: 11px; color: var(--text-3); font-family: var(--mono); margin-top: 2px; }
.sel-empty { padding: 12px; text-align: center; color: var(--text-3); font-size: 12px; }
`;
