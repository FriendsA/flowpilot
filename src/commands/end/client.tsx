import { type FC, useEffect, useReducer, useRef } from "hono/jsx";
import { render } from "hono/jsx/dom";
import i18next from "i18next";
import { filterByRelevance } from "../../utils/search";

const initPromise =
	typeof window !== "undefined" &&
	window.__I18N_LOCALE__ &&
	window.__I18N_RESOURCES__
		? i18next.init({
				lng: window.__I18N_LOCALE__,
				fallbackLng: "zh-CN",
				resources: window.__I18N_RESOURCES__,
				interpolation: { escapeValue: false },
			})
		: Promise.resolve();
const t = i18next.t;

declare global {
	interface Window {
		__I18N_LOCALE__: string;
		__I18N_RESOURCES__: Record<
			string,
			{ translation: Record<string, unknown> }
		>;
	}
}

// ── Styles ──

const endStyle = `
  .page-header {
    margin-bottom: 28px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
  }
  .page-header h2 {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 6px;
  }
  .page-header p {
    font-size: 13px;
    color: var(--text-2);
    font-weight: 300;
    line-height: 1.5;
  }

  /* ── Cwd input ── */
  .cwd-section {
    margin-bottom: 20px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .cwd-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .cwd-input {
    flex: 1;
    padding: 10px 14px;
    font-size: 13px;
    font-family: var(--mono);
    color: var(--text-1);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 8px;
    outline: none;
    transition: border-color 0.15s;
  }
  .cwd-input::placeholder { color: var(--text-3); }
  .cwd-input:focus { border-color: var(--neon); }
  .cwd-btn {
    padding: 10px 16px;
    font-size: 13px;
    font-family: var(--sans);
    font-weight: 500;
    color: var(--bg-void);
    background: var(--neon);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .cwd-btn:hover { background: var(--neon-hover); }
  .cwd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cwd-error {
    font-size: 12px;
    color: var(--error);
    margin-top: 6px;
  }
  .cwd-display {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text-1);
  }
  .cwd-display-label {
    font-size: 11px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ── Pipeline ── */
  .pipeline {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 28px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
  }
  .pipeline-step {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-family: var(--mono);
    color: var(--text-3);
    font-weight: 400;
    white-space: nowrap;
  }
  .pipeline-step.active {
    color: var(--neon);
    font-weight: 500;
  }
  .pipeline-step.done {
    color: var(--cyan);
  }
  .pipeline-node {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--text-3);
    transition: background 0.3s, box-shadow 0.3s;
  }
  .pipeline-step.active .pipeline-node {
    background: var(--neon);
    box-shadow: 0 0 8px var(--neon-glow);
    animation: neon-pulse 2s ease infinite;
  }
  .pipeline-step.done .pipeline-node {
    background: var(--cyan);
    box-shadow: 0 0 4px var(--cyan-glow);
  }
  .pipeline-line {
    width: 32px;
    height: 1px;
    background: var(--border);
    margin: 0 4px;
    transition: background 0.3s;
  }
  .pipeline-line.done { background: var(--cyan); }

  /* ── Select ── */
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
  .sel-empty { padding: 12px; text-align: center; color: var(--text-3); font-size: 12px; }

  /* ── Spinner ── */
  .spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid var(--border);
    border-top-color: var(--neon);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    color: var(--text-3);
    font-size: 13px;
    margin-bottom: 16px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* ── Info card ── */
  .info-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 16px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .info-label {
    font-size: 11px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--mono);
  }
  .info-value {
    font-size: 15px;
    font-weight: 600;
    font-family: var(--mono);
    color: var(--cyan);
    letter-spacing: -0.01em;
  }
  .info-value.neon { color: var(--neon); }

  /* ── Action button ── */
  .action-btn {
    width: 100%;
    min-height: 44px;
    padding: 10px 20px;
    font-size: 13px;
    font-family: var(--sans);
    font-weight: 500;
    color: var(--bg-void);
    background: var(--neon);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.2s;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }
  .action-btn:hover { background: var(--neon-hover); box-shadow: 0 0 12px var(--neon-glow), 0 2px 12px rgba(0,255,136,0.2); }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .action-btn.secondary {
    color: var(--text-3);
    background: transparent;
    border: 1px solid var(--border);
  }
  .action-btn.secondary:hover { border-color: var(--text-2); color: var(--text-2); }
  .action-btn.rerun {
    color: var(--text-2);
    background: var(--bg-card);
    border: 1px solid var(--border);
    margin-top: 24px;
  }
  .action-btn.rerun:hover { border-color: var(--neon); color: var(--neon); }

  /* ── Result card ── */
  .result-card {
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1px solid rgba(0,212,255,0.08);
    border-radius: 8px;
    margin-bottom: 16px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .result-success {
    border-color: rgba(0,255,136,0.12);
  }
  .result-error {
    border-color: rgba(255,68,68,0.12);
  }
  .result-label {
    font-size: 11px;
    color: var(--text-3);
    margin-bottom: 4px;
  }
  .result-key {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--neon);
    text-decoration: none;
    border-bottom: 1px dashed rgba(0,255,136,0.3);
    transition: border-color 0.2s;
  }
  .result-key:hover { border-bottom-color: var(--neon); }
  .result-text {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
  }
  .result-text.success { color: var(--neon); }
  .result-text.error { color: var(--error); }
  .result-badge {
    display: inline-block;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    margin-left: 8px;
    font-weight: 500;
    background: var(--neon-soft);
    color: var(--neon);
  }
  .mr-url-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .mr-url-input {
    flex: 1;
    padding: 8px 12px;
    font-size: 12px;
    font-family: var(--mono);
    color: var(--text-1);
    background: var(--bg-void);
    border: 1px solid var(--border);
    border-radius: 6px;
    outline: none;
  }
  .copy-btn {
    padding: 8px 12px;
    font-size: 11px;
    font-family: var(--sans);
    font-weight: 500;
    color: var(--bg-void);
    background: var(--cyan);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .copy-btn:hover { background: #33e0ff; }
  .copy-btn.copied { background: var(--neon); }

  /* ── Ticket list ── */
  .ticket-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }
  .ticket-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: border-color 0.15s;
  }
  .ticket-item:hover { border-color: var(--border-active); }
  .ticket-key {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--neon);
    text-decoration: none;
    border-bottom: 1px dashed rgba(0,255,136,0.3);
  }
  .ticket-key:hover { border-bottom-color: var(--neon); }
  .ticket-status {
    font-size: 12px;
    color: var(--text-3);
  }
  .ticket-status.success { color: var(--neon); }
  .ticket-status.error { color: var(--error); }
  .ticket-transitions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }
  .trans-btn {
    padding: 6px 12px;
    font-size: 12px;
    font-family: var(--sans);
    font-weight: 400;
    color: var(--text-2);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .trans-btn:hover { border-color: var(--neon); color: var(--neon); }
  .trans-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .trans-btn.primary {
    border-color: var(--neon);
    color: var(--neon);
    background: var(--neon-soft);
  }

  /* ── Warning ── */
  .warning-card {
    padding: 12px 16px;
    background: rgba(255,184,0,0.04);
    border: 1px solid rgba(255,184,0,0.12);
    border-radius: 8px;
    margin-bottom: 16px;
    color: var(--warning);
    font-size: 13px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .empty-hint { text-align: center; padding: 32px 0; color: var(--text-3); font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
`;

// ── Types ──

type Transition = { id: string; name: string };

type State = {
	cwd: string;
	cwdInput: string;
	cwdError: string;
	currentBranch: string;
	localBranches: string[];
	detectedSource: string;
	loading: boolean;
	error: string;
	// Step 1: Branch
	branchOpen: boolean;
	branchSearch: string;
	branchIndex: number;
	targetBranch: string;
	// Step 2: Rebase
	rebaseStatus: "idle" | "running" | "success" | "conflict" | "error";
	rebaseError: string;
	// Step 3: Push
	pushStatus: "idle" | "running" | "success" | "error";
	pushError: string;
	// Step 4: Tickets
	ticketKeys: string[];
	ticketsLoading: boolean;
	ticketsError: string;
	// Step 5: MR
	mrStatus: "idle" | "running" | "success" | "error" | "skipped";
	mrUrl: string;
	mrError: string;
	copied: boolean;
	// Step 6: Jira
	jiraStatus: Record<string, "idle" | "loading" | "success" | "error">;
	jiraTransitions: Record<string, Transition[]>;
	jiraErrors: Record<string, string>;
	jiraResults: Record<string, string>;
};

const initial: State = {
	cwd: "",
	cwdInput: "",
	cwdError: "",
	currentBranch: "",
	localBranches: [],
	detectedSource: "",
	loading: false,
	error: "",
	branchOpen: false,
	branchSearch: "",
	branchIndex: -1,
	targetBranch: "",
	rebaseStatus: "idle",
	rebaseError: "",
	pushStatus: "idle",
	pushError: "",
	ticketKeys: [],
	ticketsLoading: false,
	ticketsError: "",
	mrStatus: "idle",
	mrUrl: "",
	mrError: "",
	copied: false,
	jiraStatus: {},
	jiraTransitions: {},
	jiraErrors: {},
	jiraResults: {},
};

type Action =
	| { type: "SET_CWD_INPUT"; value: string }
	| { type: "SET_CWD"; cwd: string }
	| { type: "CWD_ERROR"; error: string }
	| { type: "LOADED"; data: { currentBranch: string; localBranches: string[]; detectedSource: string } }
	| { type: "LOAD_ERROR"; error: string }
	| { type: "SET_BRANCH_OPEN"; open: boolean }
	| { type: "SET_BRANCH_SEARCH"; search: string }
	| { type: "SET_BRANCH_INDEX"; index: number }
	| { type: "SELECT_TARGET_BRANCH"; branch: string }
	| { type: "REBASE_RUNNING" }
	| { type: "REBASE_SUCCESS" }
	| { type: "REBASE_CONFLICT" }
	| { type: "REBASE_ERROR"; error: string }
	| { type: "PUSH_RUNNING" }
	| { type: "PUSH_SUCCESS" }
	| { type: "PUSH_ERROR"; error: string }
	| { type: "TICKETS_LOADING" }
	| { type: "TICKETS_LOADED"; keys: string[] }
	| { type: "TICKETS_ERROR"; error: string }
	| { type: "MR_RUNNING" }
	| { type: "MR_SUCCESS"; url: string }
	| { type: "MR_ERROR"; error: string }
	| { type: "MR_SKIPPED" }
	| { type: "COPIED" }
	| { type: "JIRA_LOADING"; key: string }
	| { type: "JIRA_TRANSITIONS_LOADED"; key: string; transitions: Transition[] }
	| { type: "JIRA_TRANSITION_SUCCESS"; key: string; name: string }
	| { type: "JIRA_TRANSITION_ERROR"; key: string; error: string }
	| { type: "RESET" };

const reducer = (state: State, action: Action): State => {
	switch (action.type) {
		case "SET_CWD_INPUT":
			return { ...state, cwdInput: action.value, cwdError: "" };
		case "SET_CWD":
			return { ...state, cwd: action.cwd, cwdError: "" };
		case "CWD_ERROR":
			return { ...state, cwdError: action.error };
		case "LOADED":
			return {
				...state,
				...action.data,
				loading: false,
				targetBranch: action.data.detectedSource || "",
			};
		case "LOAD_ERROR":
			return { ...state, loading: false, error: action.error };
		case "SET_BRANCH_OPEN":
			return {
				...state,
				branchOpen: action.open,
				...(action.open ? {} : { branchSearch: "", branchIndex: -1 }),
			};
		case "SET_BRANCH_SEARCH":
			return { ...state, branchSearch: action.search, branchIndex: -1 };
		case "SET_BRANCH_INDEX":
			return { ...state, branchIndex: action.index };
		case "SELECT_TARGET_BRANCH":
			return {
				...state,
				targetBranch: action.branch,
				branchOpen: false,
				branchSearch: "",
				branchIndex: -1,
			};
		case "REBASE_RUNNING":
			return { ...state, rebaseStatus: "running", rebaseError: "" };
		case "REBASE_SUCCESS":
			return { ...state, rebaseStatus: "success" };
		case "REBASE_CONFLICT":
			return { ...state, rebaseStatus: "conflict" };
		case "REBASE_ERROR":
			return { ...state, rebaseStatus: "error", rebaseError: action.error };
		case "PUSH_RUNNING":
			return { ...state, pushStatus: "running", pushError: "" };
		case "PUSH_SUCCESS":
			return { ...state, pushStatus: "success" };
		case "PUSH_ERROR":
			return { ...state, pushStatus: "error", pushError: action.error };
		case "TICKETS_LOADING":
			return { ...state, ticketsLoading: true, ticketsError: "" };
		case "TICKETS_LOADED":
			return { ...state, ticketsLoading: false, ticketKeys: action.keys };
		case "TICKETS_ERROR":
			return { ...state, ticketsLoading: false, ticketsError: action.error };
		case "MR_RUNNING":
			return { ...state, mrStatus: "running", mrError: "" };
		case "MR_SUCCESS":
			return { ...state, mrStatus: "success", mrUrl: action.url };
		case "MR_ERROR":
			return { ...state, mrStatus: "error", mrError: action.error };
		case "MR_SKIPPED":
			return { ...state, mrStatus: "skipped" };
		case "COPIED":
			return { ...state, copied: true };
		case "JIRA_LOADING":
			return {
				...state,
				jiraStatus: { ...state.jiraStatus, [action.key]: "loading" },
			};
		case "JIRA_TRANSITIONS_LOADED":
			return {
				...state,
				jiraStatus: { ...state.jiraStatus, [action.key]: "idle" },
				jiraTransitions: {
					...state.jiraTransitions,
					[action.key]: action.transitions,
				},
			};
		case "JIRA_TRANSITION_SUCCESS":
			return {
				...state,
				jiraStatus: { ...state.jiraStatus, [action.key]: "success" },
				jiraResults: { ...state.jiraResults, [action.key]: action.name },
			};
		case "JIRA_TRANSITION_ERROR":
			return {
				...state,
				jiraStatus: { ...state.jiraStatus, [action.key]: "error" },
				jiraErrors: { ...state.jiraErrors, [action.key]: action.error },
			};
		case "RESET":
			return {
				...initial,
				cwd: state.cwd,
				cwdInput: state.cwd,
			};
	}
	return state;
};

// ── Helpers ──

const selKeyDown = (
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

const pipelineStepClass = (done: boolean, active: boolean) =>
	done
		? "pipeline-step done"
		: active
			? "pipeline-step active"
			: "pipeline-step";

const pipelineLineClass = (done: boolean) =>
	done ? "pipeline-line done" : "pipeline-line";

const cwdParam = (cwd: string) =>
	cwd ? `&cwd=${encodeURIComponent(cwd)}` : "";

const cwdBody = (cwd: string) => cwd ? { cwd } : {};

// ── Client Component ──

const EndClient: FC = () => {
	const [s, d] = useReducer(reducer, initial);
	const branchSearchRef = useRef<HTMLInputElement>(null);

	// Detect cwd from URL query param (set by CLI -o)
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const cwdFromQuery = params.get("cwd");
		if (cwdFromQuery) {
			d({ type: "SET_CWD", cwd: cwdFromQuery });
			d({ type: "SET_CWD_INPUT", value: cwdFromQuery });
		}
	}, []);

	// Load git status when cwd is set
	useEffect(() => {
		if (!s.cwd) return;
		d({ type: "LOAD_ERROR", error: "" }); // reset
		fetch(`/end/api/git/status?cwd=${encodeURIComponent(s.cwd)}`)
			.then((r) => r.json())
			.then((data) => {
				if (data.error) d({ type: "LOAD_ERROR", error: data.error });
				else d({ type: "LOADED", data });
			})
			.catch((e) =>
				d({ type: "LOAD_ERROR", error: e instanceof Error ? e.message : String(e) }),
			);
	}, [s.cwd]);

	// Click outside to close dropdown
	useEffect(() => {
		if (!s.branchOpen) return;
		const handler = (e: Event) => {
			if (!(e.target as HTMLElement).closest(".sel")) {
				d({ type: "SET_BRANCH_OPEN", open: false });
			}
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [s.branchOpen]);

	// Auto-focus search when dropdown opens
	useEffect(() => {
		if (s.branchOpen) setTimeout(() => branchSearchRef.current?.focus(), 50);
	}, [s.branchOpen]);

	// ── Actions ──

	const setCwd = async () => {
		const path = s.cwdInput.trim();
		if (!path) return;
		try {
			const res = await fetch("/end/api/set-cwd", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cwd: path }),
			});
			const data = await res.json();
			if (data.error) {
				d({ type: "CWD_ERROR", error: data.error });
			} else {
				d({ type: "SET_CWD", cwd: path });
			}
		} catch (e) {
			d({ type: "CWD_ERROR", error: e instanceof Error ? e.message : String(e) });
		}
	};

	const doRebase = async () => {
		d({ type: "REBASE_RUNNING" });
		try {
			const res = await fetch("/end/api/rebase", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetBranch: s.targetBranch, ...cwdBody(s.cwd) }),
			});
			const data = await res.json();
			if (data.error) {
				d({ type: "REBASE_ERROR", error: data.error });
			} else if (data.conflict) {
				d({ type: "REBASE_CONFLICT" });
			} else {
				d({ type: "REBASE_SUCCESS" });
			}
		} catch (e) {
			d({ type: "REBASE_ERROR", error: e instanceof Error ? e.message : String(e) });
		}
	};

	const doPush = async () => {
		d({ type: "PUSH_RUNNING" });
		try {
			const res = await fetch("/end/api/push", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ branch: s.currentBranch, ...cwdBody(s.cwd) }),
			});
			const data = await res.json();
			if (data.error) {
				d({ type: "PUSH_ERROR", error: data.error });
			} else {
				d({ type: "PUSH_SUCCESS" });
				// Auto-load tickets after push
				d({ type: "TICKETS_LOADING" });
				const ticketRes = await fetch(
					`/end/api/commits?base=${encodeURIComponent(s.targetBranch)}${cwdParam(s.cwd)}`,
				);
				const ticketData = await ticketRes.json();
				if (ticketData.error) {
					d({ type: "TICKETS_ERROR", error: ticketData.error });
				} else {
					d({ type: "TICKETS_LOADED", keys: ticketData.ticketKeys || [] });
					// Auto-load transitions for each ticket
					for (const key of ticketData.ticketKeys || []) {
						d({ type: "JIRA_LOADING", key });
						try {
							const transRes = await fetch(
								`/end/api/jira/transitions?key=${encodeURIComponent(key)}`,
							);
							const transData = await transRes.json();
							if (transData.transitions) {
								d({
									type: "JIRA_TRANSITIONS_LOADED",
									key,
									transitions: transData.transitions,
								});
							}
						} catch {
							d({ type: "JIRA_TRANSITION_ERROR", key, error: "Failed" });
						}
					}
				}
			}
		} catch (e) {
			d({ type: "PUSH_ERROR", error: e instanceof Error ? e.message : String(e) });
		}
	};

	const doCreateMR = async () => {
		d({ type: "MR_RUNNING" });
		try {
			const res = await fetch("/end/api/create-mr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					currentBranch: s.currentBranch,
					targetBranch: s.targetBranch,
					ticketKeys: s.ticketKeys,
					...cwdBody(s.cwd),
				}),
			});
			const data = await res.json();
			if (data.error) {
				d({ type: "MR_ERROR", error: data.error });
			} else {
				d({ type: "MR_SUCCESS", url: data.mrUrl });
				// Add comment with MR link to each ticket
				if (data.mrUrl) {
					for (const key of s.ticketKeys) {
						try {
							await fetch("/end/api/jira/comment", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									key,
									body: `提交问题 ${key} [代码|${data.mrUrl}]`,
								}),
							});
						} catch {
							/* non-critical */
						}
					}
				}
			}
		} catch (e) {
			d({ type: "MR_ERROR", error: e instanceof Error ? e.message : String(e) });
		}
	};

	const doTransition = async (key: string, transitionId: string) => {
		d({ type: "JIRA_LOADING", key });
		try {
			const res = await fetch("/end/api/jira/transition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key, transitionId }),
			});
			const data = await res.json();
			if (data.error) {
				d({ type: "JIRA_TRANSITION_ERROR", key, error: data.error });
			} else {
				const trans = s.jiraTransitions[key]?.find(
					(tr) => tr.id === transitionId,
				);
				d({ type: "JIRA_TRANSITION_SUCCESS", key, name: trans?.name ?? "Done" });
			}
		} catch (e) {
			d({
				type: "JIRA_TRANSITION_ERROR",
				key,
				error: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const copyMrUrl = async () => {
		try {
			await navigator.clipboard.writeText(s.mrUrl);
			d({ type: "COPIED" });
			setTimeout(() => d({ type: "COPIED" }), 2000);
		} catch {
			/* fallback */
		}
	};

	// ── Pipeline step states ──

	const step1Done = !!s.targetBranch;
	const step1Active = !s.loading && !s.error && !step1Done;
	const step2Done = s.rebaseStatus === "success";
	const step2Active = step1Done && s.rebaseStatus === "idle";
	const step3Done = s.pushStatus === "success";
	const step3Active = step2Done && s.pushStatus === "idle";
	const step4Done = !s.ticketsLoading && s.ticketKeys.length > 0;
	const step4Active = step3Done && s.ticketsLoading;
	const step5Done = s.mrStatus === "success" || s.mrStatus === "skipped";
	const step5Active = step4Done && s.mrStatus === "idle";
	const step6Done = s.ticketKeys.length > 0 && s.ticketKeys.every((k) => s.jiraStatus[k] === "success");
	const step6Active = step5Done && !step6Done && s.ticketKeys.length > 0;
	const allDone = s.cwd && step2Done && step3Done && step5Done;

	// ── Branch filter ──
	const fb = filterByRelevance(
		s.localBranches.map((b) => ({ name: b })),
		s.branchSearch,
	);

	// ── Render ──

	// No cwd: show path input
	if (!s.cwd) {
		return (
			<div>
				<style>{endStyle}</style>
				<div class="page-header">
					<h2>{t("web.endTitle")}</h2>
					<p>{t("web.endDesc")}</p>
				</div>
				<div class="cwd-section">
					<div class="cwd-row">
						<input
							class="cwd-input"
							type="text"
							placeholder={t("end.enterPath")}
							value={s.cwdInput}
							onChange={(e: Event) =>
								d({
									type: "SET_CWD_INPUT",
									value: (e.target as HTMLInputElement).value,
								})
							}
							onKeyDown={(e: KeyboardEvent) => {
								if (e.key === "Enter") setCwd();
							}
							}
						/>
						<button
							class="cwd-btn"
							type="button"
							disabled={!s.cwdInput.trim()}
							onClick={setCwd}
						>
							{t("end.setPath")}
						</button>
					</div>
					{s.cwdError && <div class="cwd-error">{s.cwdError}</div>}
				</div>
			</div>
		);
	}

	if (s.loading) {
		return (
			<div>
				<style>{endStyle}</style>
				<div class="cwd-display">
					<span class="cwd-display-label">{t("end.projectPath")}</span>
					<span>{s.cwd}</span>
				</div>
				<div class="loading-row">
					<span class="spinner" />
					{t("web.loading")}
				</div>
			</div>
		);
	}

	if (s.error) {
		return (
			<div>
				<style>{endStyle}</style>
				<div class="cwd-display">
					<span class="cwd-display-label">{t("end.projectPath")}</span>
					<span>{s.cwd}</span>
				</div>
				<div class="result-card result-error">
					<div class="result-text error">{s.error}</div>
				</div>
				<button
					class="action-btn rerun"
					type="button"
					onClick={() => d({ type: "RESET" })}
				>
					{t("end.rerun")}
				</button>
			</div>
		);
	}

	return (
		<div>
			<style>{endStyle}</style>
			<div class="page-header">
				<h2>{t("web.endTitle")}</h2>
				<p>{t("web.endDesc")}</p>
			</div>

			{/* ── Project path ── */}
			<div class="cwd-display">
				<span class="cwd-display-label">{t("end.projectPath")}</span>
				<span>{s.cwd}</span>
			</div>

			{/* ── Pipeline ── */}
			<div class="pipeline">
				<div class={pipelineStepClass(step1Done, step1Active)}>
					<span class="pipeline-node" />
					{t("end.stepBranch")}
				</div>
				<div class={pipelineLineClass(step1Done)} />
				<div class={pipelineStepClass(step2Done, step2Active)}>
					<span class="pipeline-node" />
					{t("end.stepRebase")}
				</div>
				<div class={pipelineLineClass(step2Done)} />
				<div class={pipelineStepClass(step3Done, step3Active)}>
					<span class="pipeline-node" />
					{t("end.stepPush")}
				</div>
				<div class={pipelineLineClass(step3Done)} />
				<div class={pipelineStepClass(step4Done, step4Active)}>
					<span class="pipeline-node" />
					{t("end.stepTickets")}
				</div>
				<div class={pipelineLineClass(step4Done)} />
				<div class={pipelineStepClass(step5Done, step5Active)}>
					<span class="pipeline-node" />
					{t("end.stepMR")}
				</div>
				<div class={pipelineLineClass(step5Done)} />
				<div class={pipelineStepClass(step6Done, step6Active)}>
					<span class="pipeline-node" />
					{t("end.stepJira")}
				</div>
			</div>

			{/* ── Step 1: Current branch + Target ── */}
			<div class="info-card">
				<span class="info-label">{t("end.currentBranch")}</span>
				<span class="info-value neon">{s.currentBranch}</span>
			</div>

			<div class="sel" style={`z-index:${s.branchOpen ? 100 : 1}`}>
				<button
					class={`sel-trigger${s.branchOpen ? " open" : ""}`}
					type="button"
					role="combobox"
					aria-expanded={s.branchOpen}
					aria-haspopup="listbox"
					onClick={() =>
						d({ type: "SET_BRANCH_OPEN", open: !s.branchOpen })
					}
				>
					<span class="sel-trigger-label">{t("end.targetBranch")}</span>
					<span
						class={`sel-trigger-value${s.targetBranch ? "" : " empty"}`}
					>
						{s.targetBranch
							? s.detectedSource && s.targetBranch === s.detectedSource
								? `${s.targetBranch} (${t("end.detectedSource")})`
								: s.targetBranch
							: t("end.selectBranch")}
					</span>
					<span class="sel-trigger-arrow">▼</span>
				</button>
				{s.branchOpen && (
					<div
						class="sel-dropdown"
						role="listbox"
						aria-label={t("end.selectBranch")}
					>
						<div class="sel-search">
							<input
								ref={branchSearchRef}
								class="sel-search-input"
								type="text"
								placeholder={t("end.selectBranch")}
								value={s.branchSearch}
								onChange={(e: Event) =>
									d({
										type: "SET_BRANCH_SEARCH",
										search: (e.target as HTMLInputElement).value,
									})
								}
								onKeyDown={(e: KeyboardEvent) => {
									const n = selKeyDown(
										e,
										s.branchOpen,
										fb.length,
										s.branchIndex,
										(i) => {
											const b = fb[i];
											if (b)
												d({
													type: "SELECT_TARGET_BRANCH",
													branch: (b as { name: string }).name,
												});
										},
										() => d({ type: "SET_BRANCH_OPEN", open: false }),
									);
									if (n !== undefined)
										d({ type: "SET_BRANCH_INDEX", index: n });
								}}
							/>
						</div>
						{fb.length > 0 ? (
							fb.map((b, i) => (
								<div
									class={`sel-item${(b as { name: string }).name === s.targetBranch ? " active" : ""}${i === s.branchIndex ? " highlighted" : ""}`}
									onMouseEnter={() =>
										d({ type: "SET_BRANCH_INDEX", index: i })
									}
									onClick={() =>
										d({
											type: "SELECT_TARGET_BRANCH",
											branch: (b as { name: string }).name,
										})
									}
								>
									<span class="sel-item-name">
										{(b as { name: string }).name}
									</span>
								</div>
							))
						) : (
							<div class="sel-empty">{t("end.selectBranch")}</div>
						)}
					</div>
				)}
			</div>

			{/* ── Step 2: Rebase ── */}
			{s.rebaseStatus === "idle" && s.targetBranch && (
				<button
					class="action-btn"
					type="button"
					onClick={doRebase}
				>
					{t("end.rebaseBtn")} → {s.targetBranch}
				</button>
			)}
			{s.rebaseStatus === "running" && (
				<div class="loading-row">
					<span class="spinner" />
					{t("end.rebasing")} {s.targetBranch}...
				</div>
			)}
			{s.rebaseStatus === "success" && (
				<div class="result-card result-success">
					<div class="result-text success">
						{t("end.rebaseResult")}: {s.targetBranch}
					</div>
				</div>
			)}
			{s.rebaseStatus === "conflict" && (
				<div class="warning-card">{t("end.conflictWarning")}</div>
			)}
			{s.rebaseStatus === "error" && (
				<div class="result-card result-error">
					<div class="result-text error">{s.rebaseError}</div>
				</div>
			)}

			{/* ── Step 3: Push ── */}
			{s.rebaseStatus === "success" && s.pushStatus === "idle" && (
				<button
					class="action-btn"
					type="button"
					onClick={doPush}
				>
					{t("end.pushBtn")} {s.currentBranch}
				</button>
			)}
			{s.pushStatus === "running" && (
				<div class="loading-row">
					<span class="spinner" />
					{t("end.pushing")}...
				</div>
			)}
			{s.pushStatus === "success" && (
				<div class="result-card result-success">
					<div class="result-text success">
						{t("end.pushResult")}: {s.currentBranch}
					</div>
				</div>
			)}
			{s.pushStatus === "error" && (
				<div class="result-card result-error">
					<div class="result-text error">{s.pushError}</div>
				</div>
			)}

			{/* ── Step 4: Ticket keys ── */}
			{s.ticketsLoading && (
				<div class="loading-row">
					<span class="spinner" />
					{t("end.analyzingCommits")}
				</div>
			)}
			{s.pushStatus === "success" && !s.ticketsLoading && (
				<div class="result-card">
					<div class="result-label">{t("end.ticketKeys")}</div>
					{s.ticketKeys.length > 0
						? s.ticketKeys.map((key) => (
								<span class="result-badge" style="margin-right:6px">{key}</span>
							))
						: t("end.noTickets")}
				</div>
			)}
			{s.ticketsError && (
				<div class="result-card result-error">
					<div class="result-text error">{s.ticketsError}</div>
				</div>
			)}

			{/* ── Step 5: Create MR ── */}
			{s.pushStatus === "success" && !s.ticketsLoading && s.mrStatus === "idle" && (
				<div style="display:flex;gap:8px">
					<button class="action-btn" type="button" onClick={doCreateMR}>
						{t("end.createMrBtn")}
					</button>
					<button
						class="action-btn secondary"
						type="button"
						onClick={() => d({ type: "MR_SKIPPED" })}
					>
						{t("end.skipMr")}
					</button>
				</div>
			)}
			{s.mrStatus === "running" && (
				<div class="loading-row">
					<span class="spinner" />
					{t("end.creatingMR")}
				</div>
			)}
			{s.mrStatus === "success" && s.mrUrl && (
				<div class="result-card result-success">
					<div class="result-text success">{t("end.mrCreated")}</div>
					<div class="mr-url-row">
						<input
							class="mr-url-input"
							type="text"
							readOnly
							value={s.mrUrl}
						/>
						<a
							class="result-key"
							href={s.mrUrl}
							target="_blank"
							rel="noreferrer"
							style="font-size:12px;padding:8px 12px;border-radius:6px"
						>
							{t("end.mrUrl")}
						</a>
						<button
							class={`copy-btn${s.copied ? " copied" : ""}`}
							type="button"
							onClick={copyMrUrl}
						>
							{s.copied ? t("end.copied") : t("end.copy")}
						</button>
					</div>
				</div>
			)}
			{s.mrStatus === "error" && (
				<div class="result-card result-error">
					<div class="result-text error">{s.mrError}</div>
				</div>
			)}
			{s.mrStatus === "skipped" && (
				<div class="result-card">
					<div class="result-label">{t("end.manualMR")} {s.targetBranch}</div>
				</div>
			)}

			{/* ── Step 6: Jira transitions ── */}
			{(s.mrStatus === "success" || s.mrStatus === "skipped") &&
				s.ticketKeys.length > 0 && (
				<div class="ticket-list">
					{s.ticketKeys.map((key) => (
						<div class="ticket-item">
							<div style="flex:1">
								<a
									class="ticket-key"
									href={`#/browse/${key}`}
									target="_blank"
									rel="noreferrer"
								>
									{key}
								</a>
								{s.jiraResults[key] && (
									<span
										class="ticket-status success"
										style="margin-left:8px"
									>
										→ {s.jiraResults[key]}
									</span>
								)}
								{s.jiraErrors[key] && (
									<span
										class="ticket-status error"
										style="margin-left:8px"
									>
										{t("end.transitionFailed")}
									</span>
								)}
							</div>
							{s.jiraStatus[key] === "success" ? (
								<span class="result-badge">{t("end.transitionSuccess")}</span>
							) : s.jiraStatus[key] === "loading" ? (
								<span class="spinner" />
							) : (
								s.jiraTransitions[key]?.length > 0 && (
									<div class="ticket-transitions">
										{s.jiraTransitions[key]
											.filter(
												(tr) =>
													tr.name === "完成" ||
													tr.name === "Done" ||
													tr.name.toLowerCase().includes("done"),
											)
											.slice(0, 1)
											.map((tr) => (
												<button
													class="trans-btn primary"
													type="button"
													onClick={() => doTransition(key, tr.id)}
													disabled={s.jiraStatus[key] === "loading"}
												>
													{tr.name}
												</button>
											))}
										{s.jiraTransitions[key]
											.filter(
												(tr) =>
													tr.name !== "完成" &&
													tr.name !== "Done" &&
													!tr.name.toLowerCase().includes("done"),
											)
											.slice(0, 3)
											.map((tr) => (
												<button
													class="trans-btn"
													type="button"
													onClick={() => doTransition(key, tr.id)}
													disabled={s.jiraStatus[key] === "loading"}
												>
													{tr.name}
												</button>
											))}
									</div>
								)
							)}
						</div>
					))}
				</div>
			)}

			{/* ── Done + Rerun ── */}
			{allDone && (
				<div class="result-card result-success">
					<div class="result-text success">{t("end.done")}</div>
				</div>
			)}
			{allDone && (
				<button
					class="action-btn rerun"
					type="button"
					onClick={() => d({ type: "RESET" })}
				>
					{t("end.rerun")}
				</button>
			)}
		</div>
	);
};

export const mount = async (el: HTMLElement) => {
	await initPromise;
	render(<EndClient />, el);
};