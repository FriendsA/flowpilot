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

// ── History entry type ──

type ReleaseHistoryEntry = {
	id: string;
	createdAt: string;
	projectId: number;
	projectName: string;
	projectPath: string;
	branch: string;
	jiraProjectKey: string;
	mrUrl?: string;
	mrSourceBranch?: string;
	mrTargetBranch?: string;
};

type QuickResult = {
	issueKey: string;
	issueUrl: string;
	version: string;
	versionCreated: boolean;
	issueCreated: boolean;
	mrUrl?: string;
	mrSourceBranch?: string;
	mrTargetBranch?: string;
};

const releaseStyle = `
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
    color: var(--text-1, #E2E8F0);
    background: var(--bg-input, #0A0E14);
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
    color: var(--text-3, #64748B);
    flex-shrink: 0;
  }
  .sel-trigger-value {
    flex: 1;
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1, #E2E8F0);
  }
  .sel-trigger-value.empty {
    color: var(--text-3);
    font-weight: 300;
  }
  .sel-trigger-arrow {
    color: var(--text-3, #64748B);
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
    background: var(--bg-card, #111820);
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
    background: var(--bg-card, #111820);
    z-index: 1;
  }
  .sel-search-input {
    width: 100%;
    padding: 6px 10px;
    font-size: 12px;
    font-family: var(--mono);
    color: var(--text-1, #E2E8F0);
    background: var(--bg-void, #0A0A0F);
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
    color: var(--text-1, #E2E8F0);
  }
  .sel-item:first-child { border-radius: 7px 7px 0 0; }
  .sel-item:last-child { border-radius: 0 0 7px 7px; }
  .sel-item:hover,
  .sel-item.highlighted { background: var(--bg-hover, rgba(0,255,136,0.04)); }
  .sel-item.active {
    background: var(--neon-soft, rgba(0,255,136,0.08));
    border-left-color: var(--neon);
    font-weight: 500;
  }
  .sel-item-name { font-weight: 500; color: var(--text-1, #E2E8F0); }
  .sel-item-sub { font-size: 11px; color: var(--text-3, #64748B); font-family: var(--mono); margin-top: 2px; }
  .sel-empty { padding: 12px; text-align: center; color: var(--text-3, #64748B); font-size: 12px; }

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

  /* ── Version display ── */
  .version-display {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    background: var(--bg-card);
    border: 1px solid rgba(0,212,255,0.08);
    border-radius: 8px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .version-tag { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.05em; font-family: var(--mono); }
  .version-number { font-size: 20px; font-weight: 600; font-family: var(--mono); color: var(--cyan); letter-spacing: -0.01em; }
  .version-error { color: var(--error); font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

  .empty-hint { text-align: center; padding: 32px 0; color: var(--text-3); font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
  .state-error { color: var(--error); font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* ── Jira ── */
  .jira-section { margin-top: 20px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .jira-btn {
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
    margin-top: 16px;
    position: relative;
    z-index: 1;
  }
  .jira-btn:hover { background: var(--neon-hover); box-shadow: 0 0 12px var(--neon-glow), 0 2px 12px rgba(0,255,136,0.2); }
  .jira-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Custom Checkbox ── */
  input[type="checkbox"] {
    appearance: none;
    width: 16px;
    height: 16px;
    border: 1px solid var(--border, rgba(0,255,136,0.2));
    border-radius: 3px;
    background: var(--bg-input, #0A0E14);
    cursor: pointer;
    position: relative;
    transition: border-color 0.15s, background 0.15s;
  }
  input[type="checkbox"]:checked {
    background: var(--neon, #00ff88);
    border-color: var(--neon, #00ff88);
  }
  input[type="checkbox"]:checked::after {
    content: "✓";
    position: absolute;
    top: -1px;
    left: 2px;
    font-size: 12px;
    font-weight: 700;
    color: var(--bg-void, #0A0A0F);
  }
  input[type="checkbox"]:focus-visible {
    outline: 2px solid var(--neon-soft, rgba(0,255,136,0.2));
    outline-offset: 2px;
  }
  .jira-result {
    margin-top: 12px;
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    position: relative;
    z-index: 1;
  }
  .jira-result-key {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--neon);
    text-decoration: none;
    border-bottom: 1px dashed rgba(0,255,136,0.3);
    transition: border-color 0.2s;
  }
  .jira-result-key:hover { border-bottom-color: var(--neon); }
  .jira-result-label { font-size: 11px; color: var(--text-3); margin-bottom: 4px; }
  .jira-result-badge { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 500; }
  .jira-result-badge.created { background: var(--neon-soft); color: var(--neon); }
  .jira-result-badge.exists { background: var(--cyan-soft); color: var(--cyan); }
  .jira-error { margin-top: 12px; color: var(--error); font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* ── History ── */
  .history-section {
    margin-bottom: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
  }
  .history-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text-1);
  }
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .history-item {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    transition: border-color 0.15s, box-shadow 0.15s;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .history-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .history-item:hover {
    border-color: var(--border-active);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .history-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }
  .history-project { font-weight: 500; color: var(--text-1); font-size: 14px; }
  .history-detail { font-size: 12px; color: var(--text-3); font-family: var(--mono); }
  .history-actions { display: flex; align-items: center; gap: 8px; }
  .history-quick-btn {
    padding: 6px 14px;
    font-size: 12px;
    font-family: var(--sans);
    font-weight: 500;
    color: var(--bg-void);
    background: var(--neon);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .history-quick-btn:hover { background: var(--neon-hover); }
  .history-quick-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .history-quick-btn.executing {
    background: var(--border);
    color: var(--text-3);
  }
  .history-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .history-new-btn {
    padding: 8px 16px;
    font-size: 13px;
    font-family: var(--sans);
    font-weight: 500;
    color: var(--bg-void);
    background: var(--neon);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.2s;
  }
  .history-new-btn:hover { background: var(--neon-hover); box-shadow: 0 0 12px var(--neon-glow); }
  .history-clear-btn {
    padding: 8px 16px;
    font-size: 13px;
    font-family: var(--sans);
    font-weight: 400;
    color: var(--text-3);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .history-clear-btn:hover { border-color: var(--error); color: var(--error); }
  .history-result {
    margin-top: 12px;
    padding: 10px 14px;
    background: var(--bg-void);
    border: 1px solid rgba(0,255,136,0.08);
    border-radius: 8px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .history-result-key {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--neon);
    text-decoration: none;
  }
  .history-result-error {
    color: var(--error);
    font-size: 13px;
  }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fade-in 0.2s ease both;
  }
  .modal-content {
    width: 90%;
    max-width: 560px;
    background: var(--bg-void);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .modal-title { font-size: 18px; font-weight: 600; color: var(--text-1); }
  .modal-close {
    width: 32px; height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: var(--text-3);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .modal-close:hover { border-color: var(--text-2); color: var(--text-2); }
`;

type Project = {
	id: number;
	name: string;
	path?: string;
	pathWithNamespace?: string;
	description?: string;
	defaultBranch?: string;
};
type Branch = { name: string; default?: boolean };
type PomInfo = {
	version: string | null;
	groupId: string | null;
	flowPilotName: string | null;
};
type JiraProject = { key: string; id: string; name?: string };

// ── State ──

type State = {
	jiraHost: string;
	projects: Project[];
	projectsLoading: boolean;
	projectsError: string;
	projectOpen: boolean;
	projectSearch: string;
	projectIndex: number;
	selected: Project | null;
	branches: Branch[];
	branchesLoading: boolean;
	branchOpen: boolean;
	branchSearch: string;
	branchIndex: number;
	selectedBranch: string;
	pomInfo: PomInfo | null;
	pomLoading: boolean;
	pomError: string;
	jiraProjects: JiraProject[];
	jiraProjectsLoading: boolean;
	jiraProjectOpen: boolean;
	jiraProjectSearch: string;
	jiraProjectIndex: number;
	selectedJiraProject: JiraProject | null;
	jiraStatus: "idle" | "checking" | "creating" | "done" | "error";
	jiraResult: { key: string; exists: boolean; versionName: string } | null;
	jiraError: string;
	mrStatus: "idle" | "loading" | "selecting" | "creating" | "done" | "error";
	mrUrl: string;
	mrError: string;
	mrBranches: Branch[];
	mrSourceBranch: string;
	mrTargetBranch: string;
	mrBranchOpen: boolean;
	mrBranchSearch: string;
	mrBranchIndex: number;
	// History state
	history: ReleaseHistoryEntry[];
	historyLoading: boolean;
	quickExecuting: string | null;
	quickResults: Record<string, QuickResult>;
	quickErrors: Record<string, string>;
	showNewModal: boolean;
	clearConfirm: boolean;
	createMrChecked: Record<string, boolean>;
};

const initial: State = {
	jiraHost: "",
	projects: [],
	projectsLoading: true,
	projectsError: "",
	projectOpen: false,
	projectSearch: "",
	projectIndex: -1,
	selected: null,
	branches: [],
	branchesLoading: false,
	branchOpen: false,
	branchSearch: "",
	branchIndex: -1,
	selectedBranch: "",
	pomInfo: null,
	pomLoading: false,
	pomError: "",
	jiraProjects: [],
	jiraProjectsLoading: false,
	jiraProjectOpen: false,
	jiraProjectSearch: "",
	jiraProjectIndex: -1,
	selectedJiraProject: null,
	jiraStatus: "idle",
	jiraResult: null,
	jiraError: "",
	mrStatus: "idle",
	mrUrl: "",
	mrError: "",
	mrBranches: [],
	mrSourceBranch: "",
	mrTargetBranch: "",
	mrBranchOpen: false,
	mrBranchSearch: "",
	mrBranchIndex: -1,
	history: [],
	historyLoading: true,
	quickExecuting: null,
	quickResults: {},
	quickErrors: {},
	showNewModal: false,
	clearConfirm: false,
	createMrChecked: {},
};

// ── Actions ──

type Action =
	| { type: "SET_JIRA_HOST"; host: string }
	| { type: "PROJECTS_LOADED"; projects: Project[] }
	| { type: "PROJECTS_ERROR"; error: string }
	| { type: "SET_PROJECT_OPEN"; open: boolean }
	| { type: "SET_PROJECT_SEARCH"; search: string }
	| { type: "SET_PROJECT_INDEX"; index: number }
	| { type: "SELECT_PROJECT"; project: Project }
	| { type: "CLEAR_PROJECT" }
	| { type: "BRANCHES_LOADING" }
	| { type: "BRANCHES_LOADED"; branches: Branch[] }
	| { type: "SET_BRANCH_OPEN"; open: boolean }
	| { type: "SET_BRANCH_SEARCH"; search: string }
	| { type: "SET_BRANCH_INDEX"; index: number }
	| { type: "SELECT_BRANCH"; branch: string }
	| { type: "POM_LOADING" }
	| { type: "POM_LOADED"; info: PomInfo }
	| { type: "POM_ERROR"; error: string }
	| { type: "JIRA_PROJECTS_LOADING" }
	| { type: "JIRA_PROJECTS_LOADED"; projects: JiraProject[] }
	| { type: "JIRA_PROJECTS_ERROR"; error: string }
	| { type: "SET_JIRA_PROJECT_OPEN"; open: boolean }
	| { type: "SET_JIRA_PROJECT_SEARCH"; search: string }
	| { type: "SET_JIRA_PROJECT_INDEX"; index: number }
	| { type: "SELECT_JIRA_PROJECT"; project: JiraProject }
	| { type: "CLEAR_JIRA_PROJECT" }
	| { type: "JIRA_CHECKING" }
	| { type: "JIRA_CREATING" }
	| {
			type: "JIRA_DONE";
			result: { key: string; exists: boolean; versionName: string };
	  }
	| { type: "JIRA_ERROR"; error: string }
	| { type: "JIRA_RESET" }
	// History actions
	| { type: "SET_HISTORY"; history: ReleaseHistoryEntry[] }
	| { type: "QUICK_EXEC_START"; id: string }
	| { type: "QUICK_EXEC_SUCCESS"; id: string; result: QuickResult }
	| { type: "QUICK_EXEC_FAIL"; id: string; error: string }
	| { type: "SHOW_NEW_MODAL" }
	| { type: "HIDE_NEW_MODAL" }
	| { type: "CLEAR_CONFIRM_TOGGLE" }
	| { type: "CLEAR_HISTORY_DONE" }
	| { type: "TOGGLE_CREATE_MR"; id: string }
		| { type: "MR_LOADING" }
			| { type: "MR_SELECTING"; branches: { name: string; default?: boolean }[] }
		| { type: "MR_SOURCE_SELECTED"; branch: string }
		| { type: "SET_MR_BRANCH_OPEN"; open: boolean }
		| { type: "SET_MR_BRANCH_SEARCH"; search: string }
		| { type: "SET_MR_BRANCH_INDEX"; index: number }
		| { type: "MR_CREATING" }
		| { type: "MR_DONE"; mrUrl: string; mrSourceBranch: string; mrTargetBranch: string }
		| { type: "MR_ERROR"; error: string };

const reducer = (state: State, action: Action): State => {
	switch (action.type) {
		case "SET_JIRA_HOST":
			return { ...state, jiraHost: action.host };
		case "PROJECTS_LOADED":
			return { ...state, projects: action.projects, projectsLoading: false };
		case "PROJECTS_ERROR":
			return { ...state, projectsError: action.error, projectsLoading: false };
		case "SET_PROJECT_OPEN":
			return {
				...state,
				projectOpen: action.open,
				...(action.open ? {} : { projectSearch: "", projectIndex: -1 }),
			};
		case "SET_PROJECT_SEARCH":
			return { ...state, projectSearch: action.search, projectIndex: -1 };
		case "SET_PROJECT_INDEX":
			return { ...state, projectIndex: action.index };
		case "SELECT_PROJECT":
			return {
				...state,
				selected: action.project,
				projectOpen: false,
				projectSearch: "",
				projectIndex: -1,
				branches: [],
				branchesLoading: false,
				selectedBranch: "",
				branchOpen: false,
				branchSearch: "",
				branchIndex: -1,
				pomInfo: null,
				pomError: "",
				selectedJiraProject: null,
				jiraStatus: "idle",
				jiraResult: null,
				jiraError: "",
				mrStatus: "idle",
				mrUrl: "",
				mrError: "",
				mrBranches: [],
				mrSourceBranch: "",
				mrTargetBranch: "",
				mrBranchOpen: false,
				mrBranchSearch: "",
				mrBranchIndex: -1,
			};
		case "CLEAR_PROJECT":
			return {
				...state,
				selected: null,
				branches: [],
				selectedBranch: "",
				branchOpen: false,
				branchSearch: "",
				branchIndex: -1,
				pomInfo: null,
				pomError: "",
				pomLoading: false,
				selectedJiraProject: null,
				jiraStatus: "idle",
				jiraResult: null,
				jiraError: "",
				mrStatus: "idle",
				mrUrl: "",
				mrError: "",
				mrBranches: [],
				mrSourceBranch: "",
				mrTargetBranch: "",
				mrBranchOpen: false,
				mrBranchSearch: "",
				mrBranchIndex: -1,
			};
		case "BRANCHES_LOADING":
			return {
				...state,
				branchesLoading: true,
				branches: [],
				selectedBranch: "",
			};
		case "BRANCHES_LOADED":
			return { ...state, branches: action.branches, branchesLoading: false };
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
		case "SELECT_BRANCH":
			return {
				...state,
				selectedBranch: action.branch,
				branchOpen: false,
				branchSearch: "",
				branchIndex: -1,
			};
		case "POM_LOADING":
			return { ...state, pomLoading: true, pomError: "", pomInfo: null };
		case "POM_LOADED":
			return { ...state, pomLoading: false, pomInfo: action.info };
		case "POM_ERROR":
			return { ...state, pomLoading: false, pomError: action.error };
		case "JIRA_PROJECTS_LOADING":
			return { ...state, jiraProjectsLoading: true };
		case "JIRA_PROJECTS_LOADED":
			return {
				...state,
				jiraProjects: action.projects,
				jiraProjectsLoading: false,
			};
		case "JIRA_PROJECTS_ERROR":
			return { ...state, jiraProjectsLoading: false };
		case "SET_JIRA_PROJECT_OPEN":
			return {
				...state,
				jiraProjectOpen: action.open,
				...(action.open ? {} : { jiraProjectSearch: "", jiraProjectIndex: -1 }),
			};
		case "SET_JIRA_PROJECT_SEARCH":
			return {
				...state,
				jiraProjectSearch: action.search,
				jiraProjectIndex: -1,
			};
		case "SET_JIRA_PROJECT_INDEX":
			return { ...state, jiraProjectIndex: action.index };
		case "SELECT_JIRA_PROJECT":
			return {
				...state,
				selectedJiraProject: action.project,
				jiraProjectOpen: false,
				jiraProjectSearch: "",
				jiraProjectIndex: -1,
				jiraStatus: "idle",
				jiraResult: null,
				jiraError: "",
			};
		case "CLEAR_JIRA_PROJECT":
			return {
				...state,
				selectedJiraProject: null,
				jiraProjectOpen: false,
				jiraProjectSearch: "",
				jiraProjectIndex: -1,
				jiraStatus: "idle",
				jiraResult: null,
				jiraError: "",
			};
		case "JIRA_CHECKING":
			return {
				...state,
				jiraStatus: "checking",
				jiraResult: null,
				jiraError: "",
			};
		case "JIRA_CREATING":
			return { ...state, jiraStatus: "creating" };
		case "JIRA_DONE":
			return { ...state, jiraStatus: "done", jiraResult: action.result };
		case "JIRA_ERROR":
			return { ...state, jiraStatus: "error", jiraError: action.error };
		case "JIRA_RESET":
			return { ...state, jiraStatus: "idle", jiraResult: null, jiraError: "" };
		// History actions
		case "SET_HISTORY":
			return { ...state, history: action.history, historyLoading: false };
		case "QUICK_EXEC_START":
			return {
				...state,
				quickExecuting: action.id,
			};
		case "QUICK_EXEC_SUCCESS":
			return {
				...state,
				quickExecuting: null,
				quickResults: { ...state.quickResults, [action.id]: action.result },
			};
		case "QUICK_EXEC_FAIL":
			return {
				...state,
				quickExecuting: null,
				quickErrors: { ...state.quickErrors, [action.id]: action.error },
			};
		case "SHOW_NEW_MODAL":
			return { ...state, showNewModal: true };
		case "HIDE_NEW_MODAL":
			return { ...state, showNewModal: false };
		case "CLEAR_CONFIRM_TOGGLE":
			return { ...state, clearConfirm: !state.clearConfirm };
		case "CLEAR_HISTORY_DONE":
			return { ...state, history: [], clearConfirm: false, quickResults: {}, quickErrors: {} };
		case "TOGGLE_CREATE_MR":
			return { ...state, createMrChecked: { ...state.createMrChecked, [action.id]: !state.createMrChecked[action.id] } };
		case "MR_SELECTING":
			return { ...state, mrStatus: "selecting", mrBranches: action.branches, mrSourceBranch: "", mrTargetBranch: "", mrError: "" };
		case "MR_SOURCE_SELECTED":
			return { ...state, mrSourceBranch: action.branch, mrBranchOpen: false, mrBranchSearch: "", mrBranchIndex: -1 };
		case "SET_MR_BRANCH_OPEN":
			return { ...state, mrBranchOpen: action.open, ...(action.open ? {} : { mrBranchSearch: "", mrBranchIndex: -1 }) };
		case "SET_MR_BRANCH_SEARCH":
			return { ...state, mrBranchSearch: action.search, mrBranchIndex: -1 };
		case "SET_MR_BRANCH_INDEX":
			return { ...state, mrBranchIndex: action.index };
		case "MR_LOADING":
			return { ...state, mrStatus: "loading", mrBranches: [], mrSourceBranch: "", mrTargetBranch: "", mrError: "" };
		case "MR_CREATING":
			return { ...state, mrStatus: "creating", mrUrl: "", mrTargetBranch: "", mrError: "" };
		case "MR_DONE":
			return {
					...state,
					mrStatus: "done",
					mrUrl: action.mrUrl,
					mrSourceBranch: action.mrSourceBranch,
					mrTargetBranch: action.mrTargetBranch,
					history: state.history.map((e) =>
						e.projectId === state.selected?.id && e.branch === state.selectedBranch
							? { ...e, mrUrl: action.mrUrl, mrSourceBranch: action.mrSourceBranch, mrTargetBranch: action.mrTargetBranch }
							: e,
					),
				};
		case "MR_ERROR":
			return { ...state, mrStatus: "error", mrError: action.error };
	}
};

// ── Helpers ──

const cleanVersion = (v: string | null) => (v ?? "").split("-")[0];

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

// ── Pipeline step class helper ──

const pipelineStepClass = (done: boolean, active: boolean) =>
	done
		? "pipeline-step done"
		: active
			? "pipeline-step active"
			: "pipeline-step";

const pipelineLineClass = (done: boolean) =>
	done ? "pipeline-line done" : "pipeline-line";

// ── History List Component ──

const HistoryList: FC<{ s: State; d: (action: Action) => void }> = ({
	s,
	d,
}) => {
	const handleQuickExecute = async (id: string) => {
		d({ type: "QUICK_EXEC_START", id });
		try {
			const res = await fetch(`/release/api/history/${id}/execute`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: s.createMrChecked[id] ?? false }),
			});
			const data = await res.json();
			if (data.error) {
				d({ type: "QUICK_EXEC_FAIL", id, error: data.error });
			} else {
				d({ type: "QUICK_EXEC_SUCCESS", id, result: data });
				// Refresh history
				const histRes = await fetch("/release/api/history");
				const histData = await histRes.json();
				d({ type: "SET_HISTORY", history: histData });
			}
		} catch (e) {
			d({
				type: "QUICK_EXEC_FAIL",
				id,
				error: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const handleClearHistory = async () => {
		await fetch("/release/api/history", { method: "DELETE" });
		d({ type: "CLEAR_HISTORY_DONE" });
	};

	return (
		<div class="history-section">
			<div class="history-title">{t("web.historyTitle")}</div>
			{s.history.length > 0 ? (
				<div class="history-list">
					{s.history.map((entry) => (
						<div class="history-item">
							<div class="history-item-row">
								<div class="history-info">
									<span class="history-project">{entry.projectName}</span>
									<span class="history-detail">
										{entry.branch} / {entry.jiraProjectKey}
									</span>
									{entry.mrUrl && (
										<span style="font-size:12px;color:var(--text-3);margin-left:6px">
											{t("release.mrFromTo", { source: entry.mrSourceBranch ?? "", target: entry.mrTargetBranch ?? entry.branch })}
										</span>
									)}
								</div>
								<div class="history-actions">
										{entry.mrUrl && (
										<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-3);cursor:pointer">
											<input
												type="checkbox"
												checked={s.createMrChecked[entry.id] ?? false}
												onChange={() => d({ type: "TOGGLE_CREATE_MR", id: entry.id })}
											/>
											{t("web.createMrCheckbox")}
										</label>
										)}
									<button
										class={`history-quick-btn${s.quickExecuting === entry.id ? " executing" : ""}`}
										type="button"
										disabled={s.quickExecuting !== null}
										onClick={() => handleQuickExecute(entry.id)}
									>
										{s.quickExecuting === entry.id
											? t("web.executing")
											: t("web.quickExecute")}
									</button>
								</div>
							</div>
							{s.quickResults[entry.id] && (
								<div class="history-result">
									<a
									class="history-result-key"
									href={s.quickResults[entry.id].issueUrl}
									target="_blank"
									rel="noreferrer"
									>
									{s.quickResults[entry.id].issueKey}
									</a>
									<span
									class={`jira-result-badge ${s.quickResults[entry.id].issueCreated ? "created" : "exists"}`}
									>
										{s.quickResults[entry.id].issueCreated ? t("web.createdBadge") : t("web.existsBadge")}
									</span>
									<span style="font-size:12px;color:var(--text-3);margin-left:8px">
										v{s.quickResults[entry.id].version}
									</span>
									{s.quickResults[entry.id].versionCreated && (
									<span style="font-size:10px;color:var(--neon);margin-left:4px">
										{t("web.createdBadge")}
									</span>
									)}
									{s.quickResults[entry.id].mrUrl && (
									<span style="font-size:12px;margin-left:12px">
										<a href={s.quickResults[entry.id].mrUrl} target="_blank" rel="noreferrer" style="color:var(--cyan);text-decoration:none;border-bottom:1px dashed var(--cyan)">
											{t("release.mrFromTo", { source: s.quickResults[entry.id].mrSourceBranch ?? "", target: s.quickResults[entry.id].mrTargetBranch ?? entry.branch })}
										</a>
									</span>
									)}
								</div>
							)}
							{s.quickErrors[entry.id] && (
								<div class="history-result-error">{s.quickErrors[entry.id]}</div>
							)}
						</div>
					))}
				</div>
			) : (
				<div class="empty-hint">{t("web.noHistory")}</div>
			)}
			<div class="history-footer">
				<button
					class="history-new-btn"
					type="button"
					onClick={() => d({ type: "SHOW_NEW_MODAL" })}
				>
					{t("web.createNew")}
				</button>
				{s.history.length > 0 &&
					(s.clearConfirm ? (
						<div style="display:flex;align-items:center;gap:8px">
							<span style="font-size:12px;color:var(--text-3)">
								{t("web.clearConfirm")}
							</span>
							<button
								class="history-clear-btn"
								type="button"
								style="border-color:var(--error);color:var(--error)"
								onClick={handleClearHistory}
							>
								{t("web.clearHistory")}
							</button>
							<button
								class="history-clear-btn"
								type="button"
								onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
							>
								{t("web.cancel")}
							</button>
						</div>
					) : (
						<button
							class="history-clear-btn"
							type="button"
							onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
						>
							{t("web.clearHistory")}
						</button>
					))}
			</div>
		</div>
	);
};

// ── Release Flow Component (existing logic) ──

const ReleaseFlow: FC<{ s: State; d: (action: Action) => void }> = ({
	s,
	d,
}) => {
	const projectSearchRef = useRef<HTMLInputElement>(null);
	const branchSearchRef = useRef<HTMLInputElement>(null);
	const jiraSearchRef = useRef<HTMLInputElement>(null);
	const mrBranchSearchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		fetch("/release/api/config")
			.then((r) => r.json())
			.then((data) => {
				if (data.jiraHost) d({ type: "SET_JIRA_HOST", host: data.jiraHost });
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		fetch("/release/api/projects")
			.then((r) => r.json())
			.then((data) => {
				if (data.error) d({ type: "PROJECTS_ERROR", error: data.error });
				else d({ type: "PROJECTS_LOADED", projects: data });
			})
			.catch((e) => d({ type: "PROJECTS_ERROR", error: e.message }));
	}, []);

	useEffect(() => {
		if (!s.projectOpen && !s.branchOpen && !s.jiraProjectOpen && !s.mrBranchOpen) return;
		const handler = (e: Event) => {
			const target = e.target as HTMLElement;
			if (!target.closest(".sel") && !target.closest(".mr-branch-sel")) {
				d({ type: "SET_PROJECT_OPEN", open: false });
				d({ type: "SET_BRANCH_OPEN", open: false });
												d({ type: "SET_MR_BRANCH_OPEN", open: false });
				d({ type: "SET_JIRA_PROJECT_OPEN", open: false });
			}
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [s.projectOpen, s.branchOpen, s.jiraProjectOpen]);

	useEffect(() => {
		if (s.projectOpen) setTimeout(() => projectSearchRef.current?.focus(), 50);
		if (s.branchOpen) setTimeout(() => branchSearchRef.current?.focus(), 50);
		if (s.jiraProjectOpen) setTimeout(() => jiraSearchRef.current?.focus(), 50);
		if (s.mrBranchOpen) setTimeout(() => mrBranchSearchRef.current?.focus(), 50);
	}, [s.projectOpen, s.branchOpen, s.jiraProjectOpen, s.mrBranchOpen]);

	// Auto-create MR after branch is selected
	useEffect(() => {
		if (s.mrStatus !== "creating" || !s.mrSourceBranch || !s.selected) return;
		const jiraUrl2 = s.jiraResult && s.jiraHost
			? `${s.jiraHost}/browse/${s.jiraResult.key}`
			: "";
		fetch("/release/api/create-mr", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				projectId: s.selected.id,
				targetBranch: s.selectedBranch,
				sourceBranch: s.mrSourceBranch,
				jiraUrl: jiraUrl2,
			}),
		})
			.then((r) => r.json())
			.then((data) => {
				if (data.mrUrl) {
					d({ type: "MR_DONE", mrUrl: data.mrUrl, mrSourceBranch: data.sourceBranch, mrTargetBranch: data.targetBranch });
					fetch("/release/api/history").then((r) => r.json()).then((h) => d({ type: "HISTORY_LOADED", history: h }));
				}
				else d({ type: "MR_ERROR", error: data.error ?? "Failed" });
			})
			.catch((e) =>
				d({
					type: "MR_ERROR",
					error: e instanceof Error ? e.message : "Failed",
				}),
			);
	}, [s.mrStatus, s.mrSourceBranch]);

	useEffect(() => {
		if (
			!s.pomInfo?.version ||
			s.jiraProjects.length > 0 ||
			s.jiraProjectsLoading
		)
			return;
		d({ type: "JIRA_PROJECTS_LOADING" });
		fetch("/release/api/jira/projects")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data))
					d({ type: "JIRA_PROJECTS_LOADED", projects: data });
				else d({ type: "JIRA_PROJECTS_ERROR", error: data.error ?? "Failed" });
			})
			.catch(() => d({ type: "JIRA_PROJECTS_ERROR", error: "Failed" }));
	}, [s.pomInfo?.version]);

	const fetchPom = (projectId: number, ref: string) => {
		d({ type: "POM_LOADING" });
		fetch(
			`/release/api/projects/${projectId}/pom-version?ref=${encodeURIComponent(ref)}`,
		)
			.then((r) => r.json())
			.then((data) => {
				if (data.error) d({ type: "POM_ERROR", error: data.error });
				else d({ type: "POM_LOADED", info: data });
			})
			.catch(() => d({ type: "POM_ERROR", error: "Failed to fetch version" }));
	};

	const handleSelectProject = (project: Project) => {
		d({ type: "SELECT_PROJECT", project });
		d({ type: "BRANCHES_LOADING" });
		fetch(`/release/api/projects/${project.id}/branches`)
			.then((r) => r.json())
			.then((data: Branch[] | { error: string }) => {
				const list = "error" in data ? [] : (data as Branch[]);
				d({ type: "BRANCHES_LOADED", branches: list });
			})
			.catch(() => d({ type: "BRANCHES_LOADED", branches: [] }));
	};

	const handleSelectBranch = (name: string) => {
		d({ type: "SELECT_BRANCH", branch: name });
		if (s.selected) fetchPom(s.selected.id, name);
	};

	const handleCreateIssue = async () => {
		if (!s.selected || !s.pomInfo?.version || !s.selectedJiraProject) return;
		const flowPilotName = s.pomInfo.flowPilotName ?? s.selected.name;
		const projectVersion = cleanVersion(s.pomInfo.version);
		const versionName = `${flowPilotName}-${projectVersion}`;
		const summary = `${flowPilotName}-${projectVersion} ${t("web.releaseSuffix") ?? t("release.releaseSuffix")}`;

		d({ type: "JIRA_CHECKING" });
		try {
			const searchRes = await fetch("/release/api/jira/search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jql: `summary ~ "${summary}" AND project = ${s.selectedJiraProject.key}`,
					maxResults: 1,
				}),
			});
			const searchData = await searchRes.json();
			if (searchData.error) {
				d({ type: "JIRA_ERROR", error: searchData.error });
				return;
			}
			if (searchData.total > 0 && searchData.issues?.[0]) {
				d({
					type: "JIRA_DONE",
					result: { key: searchData.issues[0].key, exists: true, versionName },
				});
				// Save to history
				await fetch("/release/api/history", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						id: Date.now().toString(36),
						createdAt: new Date().toISOString(),
						projectId: s.selected.id,
						projectName: s.selected.name,
						projectPath: s.selected.pathWithNamespace ?? "",
						branch: s.selectedBranch,
						jiraProjectKey: s.selectedJiraProject.key,
					}),
				});
				return;
			}

			d({ type: "JIRA_CREATING" });
			const verRes = await fetch("/release/api/jira/ensure-version", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectKey: s.selectedJiraProject.key,
					versionName,
				}),
			});
			const verData = await verRes.json();
			if (verData.error) {
				d({ type: "JIRA_ERROR", error: verData.error });
				return;
			}

			const issueRes = await fetch("/release/api/jira/create-issue", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectKey: s.selectedJiraProject.key,
					summary,
					issuetypeId: "10000",
					customfield_15800: "无",
					customfield_13410: [{ id: verData.id }],
					customfield_13341: [{ name: "licheng.li" }],
				}),
			});
			const issueData = await issueRes.json();
			if (issueData.error) {
				d({ type: "JIRA_ERROR", error: issueData.error });
				return;
			}
			d({
				type: "JIRA_DONE",
				result: {
					key: issueData.key,
					exists: false,
					versionName: verData.name,
				},
			});
			// Save to history
			await fetch("/release/api/history", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: Date.now().toString(36),
					createdAt: new Date().toISOString(),
					projectId: s.selected.id,
					projectName: s.selected.name,
					projectPath: s.selected.pathWithNamespace ?? "",
					branch: s.selectedBranch,
					jiraProjectKey: s.selectedJiraProject.key,
				}),
			});
		} catch (e) {
			d({
				type: "JIRA_ERROR",
				error: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const fp = filterByRelevance(
		s.projects.map((p) => ({
			...p,
			name: p.name,
			path: p.pathWithNamespace ?? "",
		})),
		s.projectSearch,
	);
	const fb = filterByRelevance(
		s.branches.map((b) => ({ ...b, name: b.name })),
		s.branchSearch,
	);
	const fj = filterByRelevance(
		s.jiraProjects.map((p) => ({ ...p, name: `${p.key} ${p.name ?? ""}` })),
		s.jiraProjectSearch,
	);
	const jiraUrl =
		s.jiraResult && s.jiraHost
			? `${s.jiraHost}/browse/${s.jiraResult.key}`
			: "";

	// Pipeline step states
	const step1Done = !!s.selected;
	const step1Active = !s.projectsLoading && !step1Done;
	const step2Done = !!s.selectedBranch;
	const step2Active = !!s.selected && !step2Done;
	const step3Done = !!s.pomInfo?.version;
	const step3Active = !!s.selectedBranch && !step3Done;
	const step4Done = !!s.selectedJiraProject;
	const step4Active = !!s.pomInfo?.version && !step4Done;
	const step5Done = !!s.jiraResult;
	const step5Active = !!s.selectedJiraProject && !step5Done;

	if (s.projectsLoading)
		return (
			<div class="loading-row">
				<span class="spinner" />
				{t("web.loadingProjects")}
			</div>
		);
	if (s.projectsError) return <div class="state-error">{s.projectsError}</div>;

	return (
		<div>
			{/* ── Pipeline ── */}
			<div class="pipeline">
				<div class={pipelineStepClass(step1Done, step1Active)}>
					<span class="pipeline-node" />
					{t("web.projectLabel")}
				</div>
				<div class={pipelineLineClass(step1Done)} />
				<div class={pipelineStepClass(step2Done, step2Active)}>
					<span class="pipeline-node" />
					{t("web.branchLabel")}
				</div>
				<div class={pipelineLineClass(step2Done)} />
				<div class={pipelineStepClass(step3Done, step3Active)}>
					<span class="pipeline-node" />
					{t("web.versionTag")}
				</div>
				<div class={pipelineLineClass(step3Done)} />
				<div class={pipelineStepClass(step4Done, step4Active)}>
					<span class="pipeline-node" />
					{t("web.jiraProjectLabel")}
				</div>
				<div class={pipelineLineClass(step4Done)} />
				<div class={pipelineStepClass(step5Done, step5Active)}>
					<span class="pipeline-node" />
					{t("web.createBtn")}
				</div>
			</div>

			{/* ── Project ── */}
			<div
				class="sel"
				data-sel="project"
				style={`z-index:${s.projectOpen ? 100 : 1}`}
			>
				<button
					class={`sel-trigger${s.projectOpen ? " open" : ""}`}
					type="button"
					role="combobox"
					aria-expanded={s.projectOpen}
					aria-haspopup="listbox"
					onClick={() => {
						d({ type: "SET_BRANCH_OPEN", open: false });
						d({ type: "SET_JIRA_PROJECT_OPEN", open: false });
										d({ type: "SET_MR_BRANCH_OPEN", open: false });
						d({ type: "SET_PROJECT_OPEN", open: !s.projectOpen });
					}}
				>
					<span class="sel-trigger-label">{t("web.projectLabel")}</span>
					<span class={`sel-trigger-value${s.selected ? "" : " empty"}`}>
						{s.selected ? s.selected.name : t("web.selectProject")}
					</span>
					<span class="sel-trigger-arrow">▼</span>
				</button>
				{s.projectOpen && (
					<div
						class="sel-dropdown"
						role="listbox"
						aria-label={t("web.selectProject")}
					>
						<div class="sel-search">
							<input
								ref={projectSearchRef}
								class="sel-search-input"
								type="text"
								placeholder={t("web.searchProjects")}
								value={s.projectSearch}
								onChange={(e: Event) =>
									d({
										type: "SET_PROJECT_SEARCH",
										search: (e.target as HTMLInputElement).value,
									})
								}
								onKeyDown={(e: KeyboardEvent) => {
									const n = selKeyDown(
										e,
										s.projectOpen,
										fp.length,
										s.projectIndex,
										(i) => {
											const p = fp[i];
											if (p) handleSelectProject(p as Project);
										},
										() => d({ type: "SET_PROJECT_OPEN", open: false }),
									);
									if (n !== undefined)
										d({ type: "SET_PROJECT_INDEX", index: n });
								}}
							/>
						</div>
						{fp.length > 0 ? (
							fp.map((p, i) => (
								<div
									class={`sel-item${s.selected?.id === (p as Project).id ? " active" : ""}${i === s.projectIndex ? " highlighted" : ""}`}
									onMouseEnter={() =>
										d({ type: "SET_PROJECT_INDEX", index: i })
									}
									onClick={() => handleSelectProject(p as Project)}
								>
									<div class="sel-item-name">{(p as Project).name}</div>
									<div class="sel-item-sub">
										{(p as Project).pathWithNamespace}
									</div>
								</div>
							))
						) : (
							<div class="sel-empty">{t("web.noProjects")}</div>
						)}
					</div>
				)}
			</div>

			{/* ── Branch ── */}
			{s.selected &&
				(s.branchesLoading ? (
					<div class="loading-row">
						<span class="spinner" />
						{t("web.loadingBranches")}
					</div>
				) : (
					s.branches.length > 0 && (
						<div
							class="sel"
							data-sel="branch"
							style={`z-index:${s.branchOpen ? 100 : 1}`}
						>
							<button
								class={`sel-trigger${s.branchOpen ? " open" : ""}`}
								type="button"
								role="combobox"
								aria-expanded={s.branchOpen}
								aria-haspopup="listbox"
								onClick={() => {
									d({ type: "SET_PROJECT_OPEN", open: false });
									d({ type: "SET_JIRA_PROJECT_OPEN", open: false });
												d({ type: "SET_MR_BRANCH_OPEN", open: false });
									d({ type: "SET_BRANCH_OPEN", open: !s.branchOpen });
								}}
							>
								<span class="sel-trigger-label">{t("web.branchLabel")}</span>
								<span
									class={`sel-trigger-value${s.selectedBranch ? "" : " empty"}`}
								>
									{s.selectedBranch || t("web.selectBranch")}
								</span>
								<span class="sel-trigger-arrow">▼</span>
							</button>
							{s.branchOpen && (
								<div
									class="sel-dropdown"
									role="listbox"
									aria-label={t("web.selectBranch")}
								>
									<div class="sel-search">
										<input
											ref={branchSearchRef}
											class="sel-search-input"
											type="text"
											placeholder={t("web.filterBranches")}
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
														if (b) handleSelectBranch((b as Branch).name);
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
												class={`sel-item${(b as Branch).name === s.selectedBranch ? " active" : ""}${i === s.branchIndex ? " highlighted" : ""}`}
												onMouseEnter={() =>
													d({ type: "SET_BRANCH_INDEX", index: i })
												}
												onClick={() => handleSelectBranch((b as Branch).name)}
											>
												<span class="sel-item-name">{(b as Branch).name}</span>
												{(b as Branch).default && (
													<span style="font-size:10px;color:var(--neon);margin-left:6px">
														{t("web.defaultBranch")}
													</span>
												)}
											</div>
										))
									) : (
										<div class="sel-empty">{t("web.noBranches")}</div>
									)}
								</div>
							)}
						</div>
					)
				))}

			{/* ── Version ── */}
			{s.selected &&
				s.selectedBranch &&
				!s.branchesLoading &&
				(s.pomLoading ? (
					<div class="loading-row">
						<span class="spinner" />
						{t("web.loadingVersion")}
					</div>
				) : s.pomError ? (
					<div class="version-error" role="alert">
						{s.pomError.includes("404") ? t("web.noPom") : s.pomError}
					</div>
				) : (
					s.pomInfo && (
						<div class="version-display">
							<span class="version-tag">{t("web.versionTag")}</span>
							<span class="version-number">
								{cleanVersion(s.pomInfo.version)}
							</span>
						</div>
					)
				))}

			{/* ── Jira ── */}
			{s.selected && s.pomInfo?.version && !s.pomLoading && (
				<div class="jira-section">
					{s.jiraProjectsLoading ? (
						<div class="loading-row">
							<span class="spinner" />
							{t("web.loadingJiraProjects")}
						</div>
					) : (
						<div
							class="sel"
							data-sel="jira"
							style={`z-index:${s.jiraProjectOpen ? 100 : 1}`}
						>
							<button
								class={`sel-trigger${s.jiraProjectOpen ? " open" : ""}`}
								type="button"
								role="combobox"
								aria-expanded={s.jiraProjectOpen}
								aria-haspopup="listbox"
								onClick={() => {
									d({ type: "SET_PROJECT_OPEN", open: false });
									d({ type: "SET_BRANCH_OPEN", open: false });
									d({
										type: "SET_JIRA_PROJECT_OPEN",
										open: !s.jiraProjectOpen,
									});
								}}
							>
								<span class="sel-trigger-label">
									{t("web.jiraProjectLabel")}
								</span>
								<span
									class={`sel-trigger-value${s.selectedJiraProject ? "" : " empty"}`}
								>
									{s.selectedJiraProject
										? `${s.selectedJiraProject.key} - ${s.selectedJiraProject.name ?? ""}`
										: t("web.selectJiraProject")}
								</span>
								<span class="sel-trigger-arrow">▼</span>
							</button>
							{s.jiraProjectOpen && (
								<div
									class="sel-dropdown"
									role="listbox"
									aria-label={t("web.selectJiraProject")}
								>
									<div class="sel-search">
										<input
											ref={jiraSearchRef}
											class="sel-search-input"
											type="text"
											placeholder={t("web.searchJiraProject")}
											value={s.jiraProjectSearch}
											onChange={(e: Event) =>
												d({
													type: "SET_JIRA_PROJECT_SEARCH",
													search: (e.target as HTMLInputElement).value,
												})
											}
											onKeyDown={(e: KeyboardEvent) => {
												const n = selKeyDown(
													e,
													s.jiraProjectOpen,
													fj.length,
													s.jiraProjectIndex,
													(i) => {
														const p = fj[i];
														if (p)
															d({
																type: "SELECT_JIRA_PROJECT",
																project: p as JiraProject,
															});
													},
													() =>
														d({ type: "SET_JIRA_PROJECT_OPEN", open: false }),
												);
												if (n !== undefined)
													d({ type: "SET_JIRA_PROJECT_INDEX", index: n });
											}}
										/>
									</div>
									{fj.length > 0 ? (
										fj.map((p, i) => (
											<div
												class={`sel-item${s.selectedJiraProject?.key === (p as JiraProject).key ? " active" : ""}${i === s.jiraProjectIndex ? " highlighted" : ""}`}
												onMouseEnter={() =>
													d({ type: "SET_JIRA_PROJECT_INDEX", index: i })
												}
												onClick={() =>
													d({
														type: "SELECT_JIRA_PROJECT",
														project: p as JiraProject,
													})
												}
											>
												<span class="sel-item-name">
													{(p as JiraProject).key}
												</span>
												{(p as JiraProject).name && (
													<div class="sel-item-sub">
														{(p as JiraProject).name}
													</div>
												)}
											</div>
										))
									) : (
										<div class="sel-empty">{t("web.noJiraProjects")}</div>
									)}
								</div>
							)}
						</div>
					)}

					<button
						class="jira-btn"
						type="button"
						disabled={
							!s.selectedJiraProject ||
							s.jiraStatus === "checking" ||
							s.jiraStatus === "creating"
						}
						onClick={handleCreateIssue}
					>
						{s.jiraStatus === "checking"
							? t("web.checkingBtn")
							: s.jiraStatus === "creating"
								? t("web.creatingBtn")
								: t("web.createBtn")}
					</button>

					{(s.jiraStatus === "checking" || s.jiraStatus === "creating") && (
						<div class="loading-row" style="margin-top:12px">
							<span class="spinner" />
							{s.jiraStatus === "checking"
								? t("web.checkingIssues")
								: t("web.creatingIssue")}
						</div>
					)}

					{s.jiraResult && (
						<div class="jira-result">
							<div class="jira-result-label">
								{s.jiraResult.exists
									? t("web.versionExistsResult", {
											version: s.jiraResult.versionName,
										})
									: t("web.versionCreatedResult", {
											version: s.jiraResult.versionName,
										})}
							</div>
							<a
								class="jira-result-key"
								href={jiraUrl}
								target="_blank"
								rel="noreferrer"
							>
								{s.jiraResult.key}
							</a>
							<span
								class={`jira-result-badge ${s.jiraResult.exists ? "exists" : "created"}`}
							>
								{s.jiraResult.exists
									? t("web.existsBadge")
									: t("web.createdBadge")}
							</span>
						</div>
					)}
					{s.jiraError && (
						<div class="jira-error" role="alert">
							{s.jiraError}
						</div>
					)}
						{s.jiraResult && (s.mrStatus === "idle" || s.mrStatus === "loading") && (
							<button
							class="jira-btn"
							type="button"
							disabled={s.mrStatus === "loading"}
							style="background:var(--cyan);margin-top:12px"
							onClick={async () => {
								if (s.mrStatus === "loading") return;
								d({ type: "MR_LOADING" });
								try {
									const res = await fetch(`/release/api/projects/${s.selected!.id}/branches`);
									const data = await res.json();
									const branches = (Array.isArray(data) ? data : []).filter((b: { name: string }) => b.name !== s.selectedBranch);
									if (branches.length === 0) {
										d({ type: "MR_ERROR", error: t("release.noSourceBranches") });
										return;
									}
									d({ type: "MR_SELECTING", branches });
								} catch (e) {
									d({ type: "MR_ERROR", error: e instanceof Error ? e.message : "Failed" });
								}
							}}
							>
							{s.mrStatus === "loading" ? <><span class="spinner" style="width:12px;height:12px;border-width:1px;margin-right:6px;vertical-align:middle" />{t("web.loadingMr")}</> : t("web.createMrBtn")}
							</button>
						)}
					{s.mrStatus === "selecting" && (() => {
						const mrb = s.mrBranches.filter((b) => b.name.toLowerCase().includes(s.mrBranchSearch.toLowerCase()));
						return (
							<div class="mr-branch-sel" style="margin-top:12px">
										<div style="font-size:13px;color:var(--text-2);margin-bottom:4px">{t("release.selectMrBranch")}</div>
										<div class="sel" style="position:relative;z-index:100">
									<button
										type="button"
										class="sel-trigger"
										onClick={() => d({ type: "SET_MR_BRANCH_OPEN", open: !s.mrBranchOpen })}
									>
										<span class="sel-trigger-label">{t("web.branchLabel")}</span>
										<span class={`sel-trigger-value${s.mrSourceBranch ? "" : " empty"}`}>
											{s.mrSourceBranch || t("web.selectBranch")}
										</span>
										<span class="sel-trigger-arrow">▼</span>
									</button>
									{s.mrBranchOpen && (
										<div
											class="sel-dropdown"
											role="listbox"
											aria-label={t("release.selectMrBranch")}
										>
											<div class="sel-search">
												<input
													ref={mrBranchSearchRef}
													class="sel-search-input"
													type="text"
													placeholder={t("web.filterBranches")}
													value={s.mrBranchSearch}
													onChange={(e: Event) => d({ type: "SET_MR_BRANCH_SEARCH", search: (e.target as HTMLInputElement).value })}
													onKeyDown={(e: KeyboardEvent) => {
														const n = selKeyDown(e, s.mrBranchOpen, mrb.length, s.mrBranchIndex, (i) => { if (mrb[i]) d({ type: "MR_SOURCE_SELECTED", branch: mrb[i].name }); }, () => d({ type: "SET_MR_BRANCH_OPEN", open: false }));
														if (n !== undefined) d({ type: "SET_MR_BRANCH_INDEX", index: n });
													}}
												/>
											</div>
											{mrb.length > 0 ? (
												mrb.map((b, i) => (
													<div
														class={`sel-item${b.name === s.mrSourceBranch ? " active" : ""}${i === s.mrBranchIndex ? " highlighted" : ""}`}
														onMouseEnter={() => d({ type: "SET_MR_BRANCH_INDEX", index: i })}
														onClick={() => d({ type: "MR_SOURCE_SELECTED", branch: b.name })}
													>
														<span class="sel-item-name">{b.name}</span>
														{b.default && (
															<span style="font-size:10px;color:var(--neon);margin-left:6px">{t("web.defaultBranch")}</span>
														)}
													</div>
												))
											) : (
												<div class="sel-empty">{t("web.noBranches")}</div>
											)}
										</div>
									)}
								</div>
							</div>
						);
					})()}
							{s.mrStatus === "selecting" && s.mrSourceBranch && (
								<div style="margin-top:8px">
									<div style="font-size:13px;color:var(--text-2);margin-bottom:6px">{t("release.mrFromTo", { source: s.mrSourceBranch, target: s.selectedBranch })}</div>
									<button
									class="jira-btn" type="button"
									style="background:var(--cyan);font-size:13px;padding:4px 12px"
									onClick={() => d({ type: "MR_CREATING" })}
									>
									{t("release.confirmCreateMr")}
									</button>
								</div>
							)}
					{s.mrStatus === "creating" && (
						<div class="loading-row" style="margin-top:12px">
							<span class="spinner" />
							{t("release.creatingMrBtn")}
						</div>
					)}
						{s.mrStatus === "done" && s.mrUrl && (
							<div class="jira-result" style="margin-top:12px">
								<div class="jira-result-label">MR</div>
								<a class="jira-result-key" href={s.mrUrl} target="_blank" rel="noreferrer">
								{t("release.mrFromTo", { source: s.mrSourceBranch, target: s.selectedBranch })}
								</a>
							</div>
					)}
					{s.mrStatus === "error" && s.mrError && (
						<div class="jira-error" role="alert" style="margin-top:12px">
							{s.mrError}
						</div>
					)}
				</div>
			)}

			{!s.selected && <div class="empty-hint">{t("web.emptyHint")}</div>}
		</div>
	);
};

// ── Main Component ──

const ReleaseClient: FC = () => {
	const [s, d] = useReducer(reducer, initial);

	useEffect(() => {
		fetch("/release/api/history")
			.then((r) => r.json())
			.then((data) =>
				d({ type: "SET_HISTORY", history: Array.isArray(data) ? data : [] }),
			)
			.catch(() => d({ type: "SET_HISTORY", history: [] }));
	}, []);

	return (
		<div>
			<style>{releaseStyle}</style>
			<div class="page-header">
				<h2>{t("web.releaseTitle")}</h2>
				<p>{t("web.releaseDesc")}</p>
			</div>

			{s.historyLoading ? (
				<div class="loading-row">
					<span class="spinner" />
					{t("web.loading")}
				</div>
			) : s.showNewModal ? (
				<div
					class="modal-overlay"
					onClick={(e: Event) => {
						if ((e.target as HTMLElement).classList.contains("modal-overlay")) {
							fetch("/release/api/history")
								.then((r) => r.json())
								.then((data) => {
									d({ type: "SET_HISTORY", history: Array.isArray(data) ? data : [] });
									d({ type: "HIDE_NEW_MODAL" });
								})
							.catch(() => d({ type: "HIDE_NEW_MODAL" }));
						}
					}}
				>
					<div class="modal-content">
						<div class="modal-header">
							<span class="modal-title">{t("web.newModalTitle")}</span>
							<button
								class="modal-close"
								type="button"
								onClick={() => {
									fetch("/release/api/history")
										.then((r) => r.json())
										.then((data) => {
											d({ type: "SET_HISTORY", history: Array.isArray(data) ? data : [] });
											d({ type: "HIDE_NEW_MODAL" });
										})
										.catch(() => d({ type: "HIDE_NEW_MODAL" }));
								}}
							>
								✕
							</button>
						</div>
						<ReleaseFlow s={s} d={d} />
					</div>
				</div>
			) : s.history.length > 0 ? (
				<HistoryList s={s} d={d} />
			) : (
				<ReleaseFlow s={s} d={d} />
			)}
		</div>
	);
};

export const mount = async (el: HTMLElement) => {
	await initPromise;
	render(<ReleaseClient />, el);
};
