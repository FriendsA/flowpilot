import { type FC, useEffect, useReducer, useRef } from "hono/jsx";
import { render } from "hono/jsx/dom";
import i18next from "i18next";
import { commonCss } from "../../shared/components/common";
import { Pipeline, pipelineCss } from "../../shared/components/pipeline";
import { selectCss, selKeyDown } from "../../shared/components/select";
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

type MrHistoryEntry = {
	id: string;
	createdAt: string;
	projectPath: string;
	projectId: number;
	projectName: string;
	sourceBranch: string;
	targetBranch: string;
	title: string;
	mrUrl: string | undefined;
	mrIid: number | undefined;
	draft: boolean | undefined;
	reviewerId: number | undefined;
	ticketKeys: string[];
};

type BranchInfo = { name: string; default?: boolean };
type MemberInfo = { id: number; name: string; username: string };
type Transition = { id: string; name: string };
type ProjectInfo = {
	id: number;
	name: string;
	pathWithNamespace: string;
	defaultBranch?: string;
};

// ── Styles ──

const mrStyle = `
  ${pipelineCss}
  ${selectCss}
  ${commonCss}

  .page-header { margin-bottom: 28px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both; }
  .page-header h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 6px; }
  .page-header p { font-size: 13px; color: var(--text-2); font-weight: 300; line-height: 1.5; }

  .cwd-section { margin-bottom: 20px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .cwd-row { display: flex; gap: 8px; align-items: stretch; }
  .cwd-input { flex: 1; padding: 10px 14px; font-size: 13px; font-family: var(--mono); color: var(--text-1); background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; outline: none; transition: border-color 0.15s; }
  .cwd-input::placeholder { color: var(--text-3); }
  .cwd-input:focus { border-color: var(--neon); }
  .cwd-btn { padding: 10px 16px; font-size: 13px; font-family: var(--sans); font-weight: 500; color: var(--bg-void); background: var(--neon); border: none; border-radius: 8px; cursor: pointer; } .cwd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cwd-display { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; font-family: var(--mono); font-size: 12px; color: var(--text-2); animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .cwd-display code { color: var(--neon); font-weight: 500; }

  .remote-hint { padding: 12px 16px; background: var(--cyan-soft); border: 1px solid rgba(0,212,255,0.12); border-radius: 8px; font-size: 13px; color: var(--text-2); margin-bottom: 20px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

  .history-section { margin-bottom: 24px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .history-header h3 { font-size: 14px; font-weight: 500; color: var(--text-2); }
  .history-clear { padding: 4px 10px; font-size: 11px; color: var(--text-3); background: transparent; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
  .history-clear:hover { border-color: var(--error); color: var(--error); }
  .history-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; transition: border-color 0.15s; }
  .history-item:hover { border-color: var(--neon); }
  .history-info { flex: 1; font-size: 13px; color: var(--text-1); min-width: 0; }
  .history-title { font-weight: 500; word-break: break-word; }
  .history-branches { font-size: 11px; color: var(--text-3); font-family: var(--mono); margin-top: 2px; }
  .history-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
  .history-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .history-exec-btn { padding: 4px 12px; font-size: 11px; color: var(--bg-void); background: var(--neon); border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; }

  .draft-toggle { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px; cursor: pointer; }
  .draft-toggle-label { font-size: 13px; color: var(--text-2); }
  .draft-toggle-check { width: 16px; height: 16px; border: 1px solid var(--border); border-radius: 3px; display: flex; align-items: center; justify-content: center; }
  .draft-toggle-check.active { background: var(--neon); border-color: var(--neon); color: var(--bg-void); }

  .title-input, .desc-input { width: 100%; padding: 10px 14px; font-size: 13px; font-family: var(--mono); color: var(--text-1); background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; outline: none; margin-bottom: 16px; transition: border-color 0.15s; }
  .title-input:focus, .desc-input:focus { border-color: var(--neon); }
  .title-input::placeholder, .desc-input::placeholder { color: var(--text-3); }
  .input-label { font-size: 11px; color: var(--text-3); margin-bottom: 4px; }

  .mr-url-row { display: flex; align-items: center; gap: 12px; margin-top: 6px; }
  .mr-url-link { flex: 1; font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--neon); text-decoration: none; border-bottom: 1px dashed rgba(0,255,136,0.3); word-break: break-all; min-width: 0; }
  .mr-url-link:hover { border-bottom-color: var(--neon); }

  .new-mr-btn { padding: 10px 16px; font-size: 13px; font-family: var(--sans); font-weight: 500; color: var(--neon); background: transparent; border: 1px solid var(--neon); border-radius: 8px; cursor: pointer; margin-bottom: 16px; }
  .new-mr-btn:hover { background: var(--neon-soft); }

  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); overflow-y: auto; padding: 40px 0; z-index: 999; animation: fade-in 0.15s ease both; }
  .modal-box { background: var(--bg-card, #111820); border: 1px solid var(--border); border-radius: 12px; width: 90%; max-width: 540px; margin: auto; padding: 24px; box-shadow: 0 16px 48px rgba(0,0,0,0.6); animation: slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .modal-header h3 { font-size: 16px; font-weight: 600; }
  .modal-close { padding: 4px 8px; font-size: 14px; color: var(--text-3); background: transparent; border: none; cursor: pointer; }
  .modal-close:hover { color: var(--text-1); }

  .no-history { padding: 20px; text-align: center; color: var(--text-3); font-size: 13px; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
`;

// ── State ──

type State = {
	mode: "local" | "remote" | "undetermined";
	cwd: string;
	cwdInput: string;
	cwdError: string;
	currentBranch: string;
	localBranches: string[];
	detectedSource: string;
	remoteUrl: string;
	projectPath: string;
	loading: boolean;
	error: string;
	// History
	history: MrHistoryEntry[];
	clearConfirm: boolean;
	// Pipeline
	step: number;
	// Remote-mode: projects
	projects: ProjectInfo[];
	projectsLoading: boolean;
	projectOpen: boolean;
	projectSearch: string;
	projectIndex: number;
	// Remote-mode: source branch
	sourceBranch: string;
	sourceBranchOpen: boolean;
	sourceBranchSearch: string;
	sourceBranchIndex: number;
	// Branch (target)
	branchOpen: boolean;
	branchSearch: string;
	branchIndex: number;
	targetBranch: string;
	remoteBranches: BranchInfo[];
	remoteBranchesLoading: boolean;
	// Project
	projectId: number;
	projectName: string;
	// Title/Description
	mrTitle: string;
	mrDescription: string;
	// Push (local mode only)
	pushStatus: "idle" | "running" | "success" | "error";
	// Reviewer
	memberOpen: boolean;
	memberSearch: string;
	memberIndex: number;
	members: MemberInfo[];
	membersLoading: boolean;
	reviewerId: number;
	reviewerName: string;
	draft: boolean;
	// MR
	mrStatus: "idle" | "running" | "success" | "error" | "existing";
	mrUrl: string;
	mrIid: number;
	mrError: string;
	copied: boolean;
	// Quick execute
	quickExecuting: boolean;
	// Jira
	ticketKeys: string[];
	jiraStatus: Record<string, string>;
	jiraTransitions: Record<string, Transition[]>;
	jiraResults: Record<string, string>;
	// Modal
	modalOpen: boolean;
};

const initial: State = {
	mode: "undetermined",
	cwd: "",
	cwdInput: "",
	cwdError: "",
	currentBranch: "",
	localBranches: [],
	detectedSource: "",
	remoteUrl: "",
	projectPath: "",
	loading: false,
	error: "",
	history: [],
	clearConfirm: false,
	step: 0,
	projects: [],
	projectsLoading: false,
	projectOpen: false,
	projectSearch: "",
	projectIndex: -1,
	sourceBranch: "",
	sourceBranchOpen: false,
	sourceBranchSearch: "",
	sourceBranchIndex: -1,
	branchOpen: false,
	branchSearch: "",
	branchIndex: -1,
	targetBranch: "",
	remoteBranches: [],
	remoteBranchesLoading: false,
	projectId: 0,
	projectName: "",
	mrTitle: "",
	mrDescription: "",
	pushStatus: "idle",
	memberOpen: false,
	memberSearch: "",
	memberIndex: -1,
	members: [],
	membersLoading: false,
	reviewerId: 0,
	reviewerName: "",
	draft: false,
	mrStatus: "idle",
	mrUrl: "",
	mrIid: 0,
	mrError: "",
	copied: false,
	quickExecuting: false,
	ticketKeys: [],
	jiraStatus: {},
	jiraTransitions: {},
	jiraResults: {},
	modalOpen: false,
};

type Action =
	| {
			type: "SET_INIT";
			mode: "local" | "remote";
			isGitRepo: boolean;
			cwd?: string;
			currentBranch?: string;
			localBranches?: string[];
			detectedSource?: string;
			remoteUrl?: string;
			projectPath?: string;
	  }
	| { type: "SET_MODE"; mode: "local" | "remote" }
	| { type: "SET_CWD_INPUT"; input: string }
	| { type: "SET_CWD"; cwd: string; cwdError: string }
	| { type: "SET_LOADING"; loading: boolean }
	| { type: "SET_ERROR"; error: string }
	| {
			type: "SET_GIT_STATUS";
			currentBranch: string;
			localBranches: string[];
			detectedSource: string;
			remoteUrl: string;
			projectPath: string;
	  }
	| { type: "SET_HISTORY"; history: MrHistoryEntry[] }
	| { type: "CLEAR_CONFIRM_TOGGLE" }
	| { type: "CLEAR_HISTORY_DONE" }
	| { type: "SET_STEP"; step: number }
	| { type: "SET_PROJECTS"; projects: ProjectInfo[] }
	| { type: "SET_PROJECTS_LOADING"; loading: boolean }
	| { type: "SET_PROJECT_OPEN"; open: boolean }
	| { type: "SET_PROJECT_SEARCH"; search: string }
	| { type: "SET_PROJECT_INDEX"; index: number }
	| {
			type: "SELECT_REMOTE_PROJECT";
			projectId: number;
			projectName: string;
			projectPath: string;
	  }
	| { type: "SET_SOURCE_BRANCH_OPEN"; open: boolean }
	| { type: "SET_SOURCE_BRANCH_SEARCH"; search: string }
	| { type: "SET_SOURCE_BRANCH_INDEX"; index: number }
	| { type: "SELECT_SOURCE_BRANCH"; branch: string }
	| { type: "SET_BRANCH_OPEN"; open: boolean }
	| { type: "SET_BRANCH_SEARCH"; search: string }
	| { type: "SET_BRANCH_INDEX"; index: number }
	| { type: "SELECT_TARGET_BRANCH"; branch: string }
	| { type: "SET_REMOTE_BRANCHES"; branches: BranchInfo[]; loading: boolean }
	| { type: "SET_PROJECT"; projectId: number; projectName: string }
	| { type: "SET_MR_TITLE"; title: string }
	| { type: "SET_MR_DESC"; description: string }
	| { type: "SET_PUSH_STATUS"; status: string }
	| { type: "SET_MEMBER_OPEN"; open: boolean }
	| { type: "SET_MEMBER_SEARCH"; search: string }
	| { type: "SET_MEMBER_INDEX"; index: number }
	| { type: "SET_MEMBERS"; members: MemberInfo[]; loading: boolean }
	| { type: "SELECT_REVIEWER"; id: number; name: string }
	| { type: "SET_DRAFT"; draft: boolean }
	| {
			type: "SET_MR_STATUS";
			status: string;
			url?: string;
			iid?: number;
			error?: string;
			existing?: boolean;
	  }
	| { type: "SET_COPIED"; copied: boolean }
	| { type: "SET_TICKETS"; keys: string[] }
	| { type: "SET_JIRA_STATUS"; key: string; status: string }
	| { type: "SET_JIRA_TRANSITIONS"; key: string; transitions: Transition[] }
	| { type: "SET_JIRA_RESULT"; key: string; result: string }
	| { type: "TOGGLE_MODAL"; open: boolean }
	| { type: "SET_QUICK_EXECUTING"; value: boolean };

const reducer = (state: State, action: Action): State => {
	switch (action.type) {
		case "SET_INIT": {
			const base = { ...state, mode: action.mode, loading: false };
			if (action.isGitRepo) {
				return {
					...base,
					cwd: action.cwd ?? state.cwd,
					currentBranch: action.currentBranch ?? "",
					localBranches: action.localBranches ?? [],
					detectedSource: action.detectedSource ?? "",
					remoteUrl: action.remoteUrl ?? "",
					projectPath: action.projectPath ?? "",
				};
			}
			return base;
		}
		case "SET_MODE":
			return { ...state, mode: action.mode };
		case "SET_CWD_INPUT":
			return { ...state, cwdInput: action.input };
		case "SET_CWD":
			return { ...state, cwd: action.cwd, cwdError: action.cwdError };
		case "SET_LOADING":
			return { ...state, loading: action.loading };
		case "SET_ERROR":
			return { ...state, error: action.error, loading: false };
		case "SET_GIT_STATUS":
			return {
				...state,
				currentBranch: action.currentBranch,
				localBranches: action.localBranches,
				detectedSource: action.detectedSource,
				remoteUrl: action.remoteUrl,
				projectPath: action.projectPath,
				loading: false,
			};
		case "SET_HISTORY":
			return { ...state, history: action.history };
		case "CLEAR_CONFIRM_TOGGLE":
			return { ...state, clearConfirm: !state.clearConfirm };
		case "CLEAR_HISTORY_DONE":
			return { ...state, history: [], clearConfirm: false };
		case "SET_STEP":
			return { ...state, step: action.step };
		case "SET_PROJECTS":
			return { ...state, projects: action.projects, projectsLoading: false };
		case "SET_PROJECTS_LOADING":
			return { ...state, projectsLoading: action.loading };
		case "SET_PROJECT_OPEN":
			return {
				...state,
				projectOpen: action.open,
				projectSearch: "",
				projectIndex: -1,
			};
		case "SET_PROJECT_SEARCH":
			return { ...state, projectSearch: action.search, projectIndex: -1 };
		case "SET_PROJECT_INDEX":
			return { ...state, projectIndex: action.index };
		case "SELECT_REMOTE_PROJECT":
			return {
				...state,
				projectId: action.projectId,
				projectName: action.projectName,
				projectPath: action.projectPath,
				projectOpen: false,
				sourceBranch: "",
				targetBranch: "",
				remoteBranches: [],
				mrTitle: "",
				mrDescription: "",
				mrStatus: "idle",
				mrUrl: "",
				mrError: "",
				step: 1,
			};
		case "SET_SOURCE_BRANCH_OPEN":
			return {
				...state,
				sourceBranchOpen: action.open,
				sourceBranchSearch: "",
				sourceBranchIndex: -1,
			};
		case "SET_SOURCE_BRANCH_SEARCH":
			return {
				...state,
				sourceBranchSearch: action.search,
				sourceBranchIndex: -1,
			};
		case "SET_SOURCE_BRANCH_INDEX":
			return { ...state, sourceBranchIndex: action.index };
		case "SELECT_SOURCE_BRANCH":
			return {
				...state,
				sourceBranch: action.branch,
				sourceBranchOpen: false,
				step: state.step < 2 && state.targetBranch ? 2 : state.step,
			};
		case "SET_BRANCH_OPEN":
			return { ...state, branchOpen: action.open };
		case "SET_BRANCH_SEARCH":
			return { ...state, branchSearch: action.search };
		case "SET_BRANCH_INDEX":
			return { ...state, branchIndex: action.index };
		case "SELECT_TARGET_BRANCH": {
			const branchStep =
				state.mode === "local"
					? Math.max(state.step, 1) // local: advance to title after selecting target
					: Math.max(state.step, state.sourceBranch ? 2 : state.step); // remote: need both source+target
			return {
				...state,
				targetBranch: action.branch,
				branchOpen: false,
				step: branchStep,
			};
		}
		case "SET_REMOTE_BRANCHES":
			return {
				...state,
				remoteBranches: action.branches,
				remoteBranchesLoading: action.loading,
			};
		case "SET_PROJECT":
			return {
				...state,
				projectId: action.projectId,
				projectName: action.projectName,
				step: state.targetBranch ? Math.max(state.step, 1) : state.step,
			};
		case "SET_MR_TITLE":
			return { ...state, mrTitle: action.title };
		case "SET_MR_DESC":
			return { ...state, mrDescription: action.description };
		case "SET_PUSH_STATUS": {
			const pushStep =
				action.status === "success" ? Math.max(state.step, 3) : state.step;
			return {
				...state,
				pushStatus: action.status as State["pushStatus"],
				step: pushStep,
			};
		}
		case "SET_MEMBER_OPEN":
			return { ...state, memberOpen: action.open };
		case "SET_MEMBER_SEARCH":
			return { ...state, memberSearch: action.search };
		case "SET_MEMBER_INDEX":
			return { ...state, memberIndex: action.index };
		case "SET_MEMBERS":
			return {
				...state,
				members: action.members,
				membersLoading: action.loading,
			};
		case "SELECT_REVIEWER":
			return {
				...state,
				reviewerId: action.id,
				reviewerName: action.name,
				memberOpen: false,
			};
		case "SET_DRAFT":
			return { ...state, draft: action.draft };
		case "SET_MR_STATUS":
			return {
				...state,
				mrStatus: action.status as State["mrStatus"],
				mrUrl: action.url ?? state.mrUrl,
				mrIid: action.iid ?? state.mrIid,
				mrError: action.error ?? state.mrError,
			};
		case "SET_COPIED":
			return { ...state, copied: action.copied };
		case "SET_TICKETS":
			return { ...state, ticketKeys: action.keys };
		case "SET_JIRA_STATUS":
			return {
				...state,
				jiraStatus: { ...state.jiraStatus, [action.key]: action.status },
			};
		case "SET_JIRA_TRANSITIONS":
			return {
				...state,
				jiraTransitions: {
					...state.jiraTransitions,
					[action.key]: action.transitions,
				},
			};
		case "SET_JIRA_RESULT":
			return {
				...state,
				jiraResults: { ...state.jiraResults, [action.key]: action.result },
			};
		case "TOGGLE_MODAL":
			return {
				...state,
				modalOpen: action.open,
				...(action.open
					? {
							step: 0,
							sourceBranch: "",
							targetBranch: "",
							mrTitle: "",
							mrDescription: "",
							mrStatus: "idle",
							mrUrl: "",
							mrIid: 0,
							mrError: "",
							pushStatus: "idle",
							reviewerId: 0,
							reviewerName: "",
							draft: false,
							ticketKeys: [],
							jiraStatus: {},
							jiraTransitions: {},
							jiraResults: {},
							copied: false,
						}
					: {}),
			};
		case "SET_QUICK_EXECUTING":
			return { ...state, quickExecuting: action.value };
		default:
			return state;
	}
};

// ── API helpers ──

const api = (path: string, cwd: string) =>
	`/mr/api/${path}${cwd ? `?cwd=${encodeURIComponent(cwd)}` : ""}`;

// ── Component ──

const MrClient: FC = () => {
	const [s, d] = useReducer(reducer, initial);
	const branchSearchRef = useRef<HTMLInputElement>(null);
	const memberSearchRef = useRef<HTMLInputElement>(null);
	const projectSearchRef = useRef<HTMLInputElement>(null);
	const sourceBranchSearchRef = useRef<HTMLInputElement>(null);

	// ── Init on mount ──
	useEffect(() => {
		d({ type: "SET_LOADING", loading: true });
		fetch("/mr/api/init")
			.then((r) => r.json())
			.then((data) => {
				if (data.error) {
					d({ type: "SET_ERROR", error: data.error });
					return;
				}
				d({
					type: "SET_INIT",
					mode: data.mode,
					isGitRepo: data.isGitRepo,
					...(data.isGitRepo
						? {
								cwd: data.cwd ?? "",
								currentBranch: data.currentBranch ?? "",
								localBranches: data.localBranches ?? [],
								detectedSource: data.detectedSource ?? "",
								remoteUrl: data.remoteUrl ?? "",
								projectPath: data.projectPath ?? "",
							}
						: {}),
				});
			})
			.catch((e) => d({ type: "SET_ERROR", error: String(e) }));
		loadHistory();
	}, []);

	// ── Load projects when entering remote mode ──
	useEffect(() => {
		if (s.mode !== "remote" || s.projects.length > 0 || s.projectsLoading)
			return;
		d({ type: "SET_PROJECTS_LOADING", loading: true });
		fetch("/mr/api/projects")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) {
					const projects = data.map((p: unknown) => ({
						id: (p as ProjectInfo).id ?? 0,
						name: (p as ProjectInfo).name ?? "",
						pathWithNamespace: (p as ProjectInfo).pathWithNamespace ?? "",
						defaultBranch: (p as ProjectInfo).defaultBranch,
					}));
					d({ type: "SET_PROJECTS", projects });
				} else if (data.error) {
					d({ type: "SET_ERROR", error: data.error });
				}
			})
			.catch((e) => d({ type: "SET_ERROR", error: String(e) }));
	}, [s.mode]);

	// ── Click-outside handler for all dropdowns ──
	useEffect(() => {
		if (!s.projectOpen && !s.sourceBranchOpen && !s.branchOpen && !s.memberOpen)
			return;
		const handler = (e: Event) => {
			const target = e.target as HTMLElement;
			if (!target.closest(".sel")) {
				d({ type: "SET_PROJECT_OPEN", open: false });
				d({ type: "SET_SOURCE_BRANCH_OPEN", open: false });
				d({ type: "SET_BRANCH_OPEN", open: false });
				d({ type: "SET_MEMBER_OPEN", open: false });
			}
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [s.projectOpen, s.sourceBranchOpen, s.branchOpen, s.memberOpen]);

	// ── Close all other dropdowns when one opens ──
	const openProject = (open: boolean) => {
		d({ type: "SET_PROJECT_OPEN", open });
		if (open) {
			d({ type: "SET_SOURCE_BRANCH_OPEN", open: false });
			d({ type: "SET_BRANCH_OPEN", open: false });
			d({ type: "SET_MEMBER_OPEN", open: false });
		}
	};
	const openSourceBranch = (open: boolean) => {
		d({ type: "SET_SOURCE_BRANCH_OPEN", open });
		if (open) {
			d({ type: "SET_PROJECT_OPEN", open: false });
			d({ type: "SET_BRANCH_OPEN", open: false });
			d({ type: "SET_MEMBER_OPEN", open: false });
		}
	};
	const openBranch = (open: boolean) => {
		d({ type: "SET_BRANCH_OPEN", open });
		if (open) {
			d({ type: "SET_PROJECT_OPEN", open: false });
			d({ type: "SET_SOURCE_BRANCH_OPEN", open: false });
			d({ type: "SET_MEMBER_OPEN", open: false });
		}
	};
	const openMember = (open: boolean) => {
		d({ type: "SET_MEMBER_OPEN", open });
		if (open) {
			d({ type: "SET_PROJECT_OPEN", open: false });
			d({ type: "SET_SOURCE_BRANCH_OPEN", open: false });
			d({ type: "SET_BRANCH_OPEN", open: false });
		}
	};

	// ── API functions ──

	const loadGitStatus = async () => {
		d({ type: "SET_LOADING", loading: true });
		try {
			const res = await fetch(api("git/status", s.cwd));
			const data = await res.json();
			if (data.error) {
				d({ type: "SET_ERROR", error: data.error });
				return;
			}
			d({
				type: "SET_GIT_STATUS",
				currentBranch: data.currentBranch ?? "",
				localBranches: data.localBranches ?? [],
				detectedSource: data.detectedSource ?? "",
				remoteUrl: data.remoteUrl ?? "",
				projectPath: data.projectPath ?? "",
			});
		} catch (e: unknown) {
			d({ type: "SET_ERROR", error: String(e) });
		}
	};

	const loadHistory = async () => {
		try {
			const res = await fetch("/mr/api/history");
			const data = await res.json();
			d({ type: "SET_HISTORY", history: Array.isArray(data) ? data : [] });
		} catch {
			/* ignore */
		}
	};

	const setCwd = async () => {
		if (!s.cwdInput) return;
		try {
			const res = await fetch("/mr/api/set-cwd", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cwd: s.cwdInput }),
			});
			const data = await res.json();
			if (data.error) {
				d({ type: "SET_CWD", cwd: s.cwd, cwdError: data.error });
				return;
			}
			d({ type: "SET_CWD", cwd: s.cwdInput, cwdError: "" });
			if (data.isGitRepo) {
				d({ type: "SET_MODE", mode: "local" });
				await loadGitStatus();
			} else {
				d({ type: "SET_MODE", mode: "remote" });
			}
			await loadHistory();
		} catch (e: unknown) {
			d({ type: "SET_CWD", cwd: s.cwd, cwdError: String(e) });
		}
	};

	const loadRemoteBranches = async (projectId?: number) => {
		const pid = projectId ?? s.projectId;
		if (!pid) return;
		d({ type: "SET_REMOTE_BRANCHES", branches: [], loading: true });
		try {
			const res = await fetch(`/mr/api/project/${pid}/branches`);
			const data = await res.json();
			const branches = Array.isArray(data)
				? data.map((b: unknown) => ({
						name: (b as BranchInfo).name ?? String(b),
						default: (b as BranchInfo).default ?? false,
					}))
				: [];
			d({ type: "SET_REMOTE_BRANCHES", branches, loading: false });
		} catch {
			d({ type: "SET_REMOTE_BRANCHES", branches: [], loading: false });
		}
	};

	const loadMembers = async () => {
		if (!s.projectId) return;
		d({ type: "SET_MEMBERS", members: [], loading: true });
		try {
			const res = await fetch(`/mr/api/project/${s.projectId}/members`);
			const data = await res.json();
			const members = Array.isArray(data)
				? data.map((m: unknown) => ({
						id: (m as MemberInfo).id ?? 0,
						name: (m as MemberInfo).name ?? "",
						username: (m as MemberInfo).username ?? "",
					}))
				: [];
			d({ type: "SET_MEMBERS", members, loading: false });
		} catch {
			d({ type: "SET_MEMBERS", members: [], loading: false });
		}
	};

	const resolveProject = async () => {
		try {
			const res = await fetch(api("project", s.cwd));
			const data = await res.json();
			if (data.projectId) {
				d({
					type: "SET_PROJECT",
					projectId: data.projectId,
					projectName: data.projectName ?? "",
				});
			}
		} catch {
			/* project resolution failed */
		}
	};

	const pushBranch = async () => {
		d({ type: "SET_PUSH_STATUS", status: "running" });
		try {
			const res = await fetch("/mr/api/push", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ branch: s.currentBranch, cwd: s.cwd }),
			});
			const data = await res.json();
			d({
				type: "SET_PUSH_STATUS",
				status: data.success ? "success" : "error",
			});
		} catch {
			d({ type: "SET_PUSH_STATUS", status: "error" });
		}
	};

	const createMR = async () => {
		const sourceBranch = s.mode === "local" ? s.currentBranch : s.sourceBranch;
		if (!sourceBranch) {
			d({
				type: "SET_MR_STATUS",
				status: "error",
				error: `${t("web.mrFromBranch")} — ${t("web.mrSelectFrom")}`,
			});
			return;
		}
		if (!s.targetBranch) {
			d({
				type: "SET_MR_STATUS",
				status: "error",
				error: `${t("web.mrIntoBranch")} — ${t("web.mrSelectInto")}`,
			});
			return;
		}
		if (!s.mrTitle) {
			d({
				type: "SET_MR_STATUS",
				status: "error",
				error: `${t("web.mrTitleLabel")} — ${t("web.mrEnterTitle")}`,
			});
			return;
		}
		d({ type: "SET_MR_STATUS", status: "running" });
		try {
			const res = await fetch("/mr/api/create-mr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: s.projectId,
					sourceBranch,
					targetBranch: s.targetBranch,
					title: s.mrTitle,
					description: s.mrDescription,
					assigneeId: s.reviewerId || undefined,
					draft: s.draft,
					cwd: s.mode === "local" ? s.cwd : undefined,
				}),
			});
			const data = await res.json();
			if (data.error) {
				d({
					type: "SET_MR_STATUS",
					status: "error",
					error: data.detail ? `${data.error}: ${data.detail}` : data.error,
				});
				return;
			}
			d({
				type: "SET_MR_STATUS",
				status: data.existing ? "existing" : "success",
				url: data.mrUrl,
				iid: data.mrIid,
			});
			await loadHistory();
		} catch (e: unknown) {
			d({ type: "SET_MR_STATUS", status: "error", error: String(e) });
		}
	};

	const executeHistory = async (entry: MrHistoryEntry) => {
		d({ type: "SET_QUICK_EXECUTING", value: true });
		try {
			const res = await fetch(`/mr/api/history/${entry.id}/execute`, {
				method: "POST",
			});
			const data = await res.json();
			if (data.error) {
				d({ type: "SET_QUICK_EXECUTING", value: false });
				d({
					type: "SET_MR_STATUS",
					status: "error",
					error: data.detail ? `${data.error}: ${data.detail}` : data.error,
				});
				return;
			}
			d({ type: "SET_QUICK_EXECUTING", value: false });
			d({
				type: "SET_MR_STATUS",
				status: data.existing ? "existing" : "success",
				url: data.mrUrl,
				iid: data.mrIid,
			});
			await loadHistory();
		} catch (e: unknown) {
			d({ type: "SET_QUICK_EXECUTING", value: false });
			d({ type: "SET_MR_STATUS", status: "error", error: String(e) });
		}
	};

	const clearHistory = async () => {
		try {
			await fetch("/mr/api/history", { method: "DELETE" });
			d({ type: "CLEAR_HISTORY_DONE" });
		} catch {
			/* ignore */
		}
	};

	const loadJiraTransitions = async (key: string) => {
		d({ type: "SET_JIRA_STATUS", key, status: "loading" });
		try {
			const res = await fetch(
				`/mr/api/jira/transitions?key=${encodeURIComponent(key)}`,
			);
			const data = await res.json();
			const transitions = data.transitions ?? [];
			d({ type: "SET_JIRA_TRANSITIONS", key, transitions });
			d({ type: "SET_JIRA_STATUS", key, status: "loaded" });
		} catch {
			d({ type: "SET_JIRA_STATUS", key, status: "error" });
		}
	};

	const transitionJira = async (key: string, transitionId: string) => {
		d({ type: "SET_JIRA_STATUS", key, status: "transitioning" });
		try {
			const res = await fetch("/mr/api/jira/transition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key, transitionId }),
			});
			const data = await res.json();
			if (data.success) {
				d({ type: "SET_JIRA_RESULT", key, result: "success" });
			} else {
				d({ type: "SET_JIRA_RESULT", key, result: "error" });
			}
		} catch {
			d({ type: "SET_JIRA_RESULT", key, result: "error" });
		}
	};

	const addJiraComment = async (key: string, body: string) => {
		try {
			await fetch("/mr/api/jira/comment", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key, body }),
			});
		} catch {
			/* non-critical */
		}
	};

	const copyMrUrl = async () => {
		try {
			await navigator.clipboard.writeText(s.mrUrl);
			d({ type: "SET_COPIED", copied: true });
			setTimeout(() => d({ type: "SET_COPIED", copied: false }), 2000);
		} catch {
			/* clipboard API not available */
		}
	};

	// ── Filtered branches (target) ──
	const fb = filterByRelevance(
		s.remoteBranches.map((b) => ({ ...b, name: b.name })),
		s.branchSearch,
	);

	// ── Filtered members ──
	const fm = filterByRelevance(
		s.members.map((m) => ({
			...m,
			name: `${m.name} (@${m.username})`,
			path: m.username,
		})),
		s.memberSearch,
	);

	// ── Filtered projects ──
	const fp = filterByRelevance(
		s.projects.map((p) => ({
			...p,
			name: p.name,
			path: p.pathWithNamespace,
		})),
		s.projectSearch,
	);

	// ── Filtered source branches ──
	const fsb = filterByRelevance(
		s.remoteBranches.map((b) => ({ ...b, name: b.name })),
		s.sourceBranchSearch,
	);

	// ── Pipeline steps ──
	const pipelineSteps =
		s.mode === "local"
			? [
					{
						label: t("web.mrStepBranch"),
						done: s.step > 0,
						active: s.step === 0,
					},
					{
						label: t("web.mrStepTitle"),
						done: s.step > 1,
						active: s.step === 1,
					},
					{
						label: t("web.mrStepPush"),
						done: s.pushStatus === "success",
						active: s.step === 2,
					},
					{
						label: t("web.mrStepMR"),
						done: s.mrStatus === "success" || s.mrStatus === "existing",
						active: s.step === 3,
					},
					{
						label: t("web.mrStepJira"),
						done: s.ticketKeys.every((k) => s.jiraResults[k] === "success"),
						active: s.step === 4,
					},
				]
			: [
					{
						label: t("web.mrStepProject"),
						done: s.projectId > 0,
						active: s.step === 0,
					},
					{
						label: t("web.mrStepBranch"),
						done: !!s.sourceBranch && !!s.targetBranch,
						active: s.step === 1,
					},
					{
						label: t("web.mrStepTitle"),
						done: s.step > 2,
						active: s.step === 2,
					},
					{
						label: t("web.mrStepMR"),
						done: s.mrStatus === "success" || s.mrStatus === "existing",
						active: s.step === 3,
					},
					{
						label: t("web.mrStepJira"),
						done: s.ticketKeys.every((k) => s.jiraResults[k] === "success"),
						active: s.step === 4,
					},
				];

	// ── Render ──

	return (
		<>
			<style>{mrStyle}</style>

			{/* ── Header ── */}
			<div class="page-header">
				<h2>{t("web.mrTitle")}</h2>
				<p>{t("web.mrDesc")}</p>
			</div>

			{s.mode === "undetermined" && (
				<div class="loading-row">
					<span class="spinner" /> {t("web.loading")}
				</div>
			)}

			{/* ── Local mode ── */}
			{s.mode === "local" && (
				<>
					{s.cwd ? (
						<div class="cwd-display">
							<span>{t("web.mrProjectPath")}:</span>
							<code>{s.cwd}</code>
						</div>
					) : (
						<div class="cwd-section">
							<div class="cwd-row">
								<input
									class="cwd-input"
									type="text"
									placeholder={t("web.mrEnterPath")}
									value={s.cwdInput}
									onInput={(e: Event) =>
										d({
											type: "SET_CWD_INPUT",
											input: (e.target as HTMLInputElement).value,
										})
									}
								/>
								<button
									class="cwd-btn"
									type="button"
									disabled={!s.cwdInput.trim()}
									onClick={setCwd}
								>
									{t("web.mrSetPath")}
								</button>
							</div>
							{s.cwdError && <div class="cwd-error">{s.cwdError}</div>}
						</div>
					)}

					{s.loading && (
						<div class="loading-row">
							<span class="spinner" /> {t("web.loading")}
						</div>
					)}
					{s.error && <div class="result-card result-error">{s.error}</div>}

					{s.currentBranch && (
						<>
							{/* ── History exists: show history + new button (modal for creation) ── */}
							{s.history.length > 0 && !s.modalOpen && (
								<div class="history-section">
									<div class="history-header">
										<h3>{t("web.mrHistoryTitle")}</h3>
										{s.clearConfirm ? (
											<div style="display:flex;align-items:center;gap:8px">
												<span style="font-size:12px;color:var(--text-3)">
													{t("web.clearConfirm")}
												</span>
												<button
													class="history-clear"
													type="button"
													style="border-color:var(--error);color:var(--error)"
													onClick={clearHistory}
												>
													{t("web.clearHistory")}
												</button>
												<button
													class="history-clear"
													type="button"
													onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
												>
													{t("web.cancel")}
												</button>
											</div>
										) : (
											<button
												class="history-clear"
												type="button"
												onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
											>
												{t("web.clearHistory")}
											</button>
										)}
									</div>
									{s.history.map((entry: MrHistoryEntry) => (
										<div class="history-item">
											<div class="history-info">
												<div class="history-title">
													{entry.title ||
														`${entry.sourceBranch} → ${entry.targetBranch}`}
												</div>
												<div class="history-branches">
													{entry.sourceBranch} → {entry.targetBranch}
												</div>
												<div class="history-sub">
													{entry.projectName} · {entry.createdAt}
												</div>
											</div>
											<div class="history-actions">
												<button
													class="history-exec-btn"
													type="button"
													onClick={() => executeHistory(entry)}
												>
													{t("web.quickExecute")}
												</button>
											</div>
										</div>
									))}
								</div>
							)}

							{s.quickExecuting && (
								<div class="loading-row">
									<span class="spinner" /> {t("web.mrCreatingMR")}
								</div>
							)}

							{(s.mrStatus === "success" || s.mrStatus === "existing") &&
								!s.modalOpen && (
									<div class="result-card result-success">
										<div class="result-label">
											{s.mrStatus === "existing"
												? t("web.mrExistingNote")
												: t("web.mrResultUrl")}
										</div>
										<div class="mr-url-row">
											<a
												class="mr-url-link"
												href={s.mrUrl}
												target="_blank"
												rel="noopener"
											>
												{s.mrUrl}
											</a>
											<button
												class={`copy-btn${s.copied ? " copied" : ""}`}
												type="button"
												onClick={copyMrUrl}
											>
												{s.copied ? t("web.mrCopied") : t("web.mrCopy")}
											</button>
										</div>
									</div>
								)}

							{s.history.length > 0 && !s.modalOpen && !s.quickExecuting && (
								<button
									class="new-mr-btn"
									type="button"
									onClick={() => d({ type: "TOGGLE_MODAL", open: true })}
								>
									{t("web.mrNewBtn")}
								</button>
							)}

							{/* ── No history: show inline create flow ── */}
							{s.history.length === 0 && !s.modalOpen && !s.quickExecuting && (
								<>
									<Pipeline steps={pipelineSteps} />

									{/* ── Step 1: Branch ── */}
									<div>
										<div class="result-card">
											<div class="result-label">{t("web.mrFromBranch")}</div>
											<div class="result-text success">{s.currentBranch}</div>
											{s.detectedSource && (
												<span class="result-badge">
													{t("web.mrDetectSource")}: {s.detectedSource}
												</span>
											)}
										</div>

										{/* Target branch selector */}
										<div
											class="sel"
											style={`z-index:${s.branchOpen ? 100 : 1}`}
										>
											<button
												class={`sel-trigger${s.branchOpen ? " open" : ""}`}
												type="button"
												role="combobox"
												aria-expanded={s.branchOpen}
												onClick={() => {
													openBranch(!s.branchOpen);
													if (!s.remoteBranches.length && s.projectId)
														loadRemoteBranches();
												}}
											>
												<span class="sel-trigger-label">
													{t("web.mrIntoBranch")}
												</span>
												<span
													class={`sel-trigger-value${s.targetBranch ? "" : " empty"}`}
												>
													{s.targetBranch || t("web.mrSelectInto")}
												</span>
												<span class="sel-trigger-arrow">▼</span>
											</button>
											{s.branchOpen && (
												<div class="sel-dropdown" role="listbox">
													<div class="sel-search">
														<input
															ref={branchSearchRef}
															class="sel-search-input"
															type="text"
															placeholder={t("web.mrFilterInto")}
															value={s.branchSearch}
															onInput={(e: Event) =>
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
																				branch: b.name,
																			});
																	},
																	() => openBranch(false),
																);
																if (n !== undefined)
																	d({ type: "SET_BRANCH_INDEX", index: n });
															}}
														/>
													</div>
													{s.remoteBranchesLoading ? (
														<div class="sel-empty">
															<span class="spinner" />{" "}
															{t("web.mrLoadingTarget")}
														</div>
													) : fb.length > 0 ? (
														fb.map((b, i) => (
															<div
																class={`sel-item${b.name === s.targetBranch ? " active" : ""}${i === s.branchIndex ? " highlighted" : ""}`}
																onMouseEnter={() =>
																	d({ type: "SET_BRANCH_INDEX", index: i })
																}
																onClick={() =>
																	d({
																		type: "SELECT_TARGET_BRANCH",
																		branch: b.name,
																	})
																}
															>
																<span class="sel-item-name">{b.name}</span>
																{b.default && (
																	<span class="result-badge">
																		{t("web.defaultBranch")}
																	</span>
																)}
															</div>
														))
													) : (
														<div class="sel-empty">{t("web.mrNoTarget")}</div>
													)}
												</div>
											)}
										</div>

										{s.projectId ? (
											<div class="result-card">
												<div class="result-label">{t("web.projectLabel")}</div>
												<div class="result-text success">{s.projectName}</div>
											</div>
										) : (
											<button
												class="action-btn secondary"
												type="button"
												onClick={resolveProject}
											>
												{t("web.mrResolveProject")}
											</button>
										)}
									</div>

									{/* ── Step 2: Title & Description ── */}
									{s.targetBranch && (
										<div>
											<div class="input-label">{t("web.mrTitleLabel")}</div>
											<input
												class="title-input"
												type="text"
												placeholder={t("web.mrEnterTitle")}
												value={s.mrTitle}
												onInput={(e: Event) =>
													d({
														type: "SET_MR_TITLE",
														title: (e.target as HTMLInputElement).value,
													})
												}
											/>
											<div class="input-label">
												{t("web.mrDescriptionLabel")}
											</div>
											<textarea
												class="desc-input"
												placeholder={t("web.mrEnterDescription")}
												value={s.mrDescription}
												rows={4}
												onInput={(e: Event) =>
													d({
														type: "SET_MR_DESC",
														description: (e.target as HTMLInputElement).value,
													})
												}
											/>

											{/* Reviewer selector */}
											<div
												class="sel"
												style={`z-index:${s.memberOpen ? 100 : 1}`}
											>
												<button
													class={`sel-trigger${s.memberOpen ? " open" : ""}`}
													type="button"
													role="combobox"
													aria-expanded={s.memberOpen}
													onClick={() => {
														openMember(!s.memberOpen);
														if (!s.members.length && s.projectId) loadMembers();
													}}
												>
													<span class="sel-trigger-label">
														{t("web.mrReviewerLabel")}
													</span>
													<span
														class={`sel-trigger-value${s.reviewerId ? "" : " empty"}`}
													>
														{s.reviewerId
															? s.reviewerName
															: t("web.mrSkipReviewer")}
													</span>
													<span class="sel-trigger-arrow">▼</span>
												</button>
												{s.memberOpen && (
													<div class="sel-dropdown" role="listbox">
														<div class="sel-search">
															<input
																ref={memberSearchRef}
																class="sel-search-input"
																type="text"
																placeholder={t("web.mrFilterReviewer")}
																value={s.memberSearch}
																onInput={(e: Event) =>
																	d({
																		type: "SET_MEMBER_SEARCH",
																		search: (e.target as HTMLInputElement)
																			.value,
																	})
																}
																onKeyDown={(e: KeyboardEvent) => {
																	const n = selKeyDown(
																		e,
																		s.memberOpen,
																		fm.length,
																		s.memberIndex,
																		(i) => {
																			const m = fm[i];
																			if (m)
																				d({
																					type: "SELECT_REVIEWER",
																					id: m.id,
																					name: `${m.name} (@${m.username})`,
																				});
																		},
																		() => openMember(false),
																	);
																	if (n !== undefined)
																		d({ type: "SET_MEMBER_INDEX", index: n });
																}}
															/>
														</div>
														<div
															class={`sel-item${!s.reviewerId ? " active" : ""}`}
															onClick={() =>
																d({ type: "SELECT_REVIEWER", id: 0, name: "" })
															}
														>
															<span class="sel-item-name">
																{t("web.mrSkipReviewer")}
															</span>
														</div>
														{s.membersLoading ? (
															<div class="sel-empty">
																<span class="spinner" />{" "}
																{t("web.mrLoadingReviewer")}
															</div>
														) : fm.length > 0 ? (
															fm.map((m, i) => (
																<div
																	class={`sel-item${m.id === s.reviewerId ? " active" : ""}${i === s.memberIndex ? " highlighted" : ""}`}
																	onMouseEnter={() =>
																		d({ type: "SET_MEMBER_INDEX", index: i })
																	}
																	onClick={() =>
																		d({
																			type: "SELECT_REVIEWER",
																			id: m.id,
																			name: `${m.name} (@${m.username})`,
																		})
																	}
																>
																	<div class="sel-item-name">{m.name}</div>
																	<div class="sel-item-sub">@{m.username}</div>
																</div>
															))
														) : (
															<div class="sel-empty">
																{t("web.mrNoReviewer")}
															</div>
														)}
													</div>
												)}
											</div>

											{/* Draft toggle */}
											<div
												class="draft-toggle"
												onClick={() =>
													d({ type: "SET_DRAFT", draft: !s.draft })
												}
											>
												<div
													class={`draft-toggle-check${s.draft ? " active" : ""}`}
												>
													{s.draft && "✓"}
												</div>
												<span class="draft-toggle-label">
													{t("web.mrDraftToggle")}
												</span>
											</div>
										</div>
									)}

									{/* ── Step 3: Push ── */}
									{s.targetBranch && (
										<div>
											{s.pushStatus === "idle" && (
												<button
													class="action-btn"
													type="button"
													onClick={pushBranch}
												>
													{t("web.mrPushBtn")}
												</button>
											)}
											{s.pushStatus === "running" && (
												<div class="loading-row">
													<span class="spinner" /> {t("web.mrPushing")}
												</div>
											)}
											{s.pushStatus === "success" && (
												<div class="result-card result-success">
													<div class="result-label">{t("web.mrPushBtn")}</div>
													<div class="result-text success">
														{t("web.mrPushSuccess")}
													</div>
												</div>
											)}
											{s.pushStatus === "error" && (
												<div class="result-card result-error">
													<div class="result-text error">
														{t("web.mrPushFailed")}
													</div>
												</div>
											)}
											{s.pushStatus !== "success" &&
												s.pushStatus !== "running" && (
													<button
														class="action-btn secondary"
														type="button"
														onClick={() => d({ type: "SET_STEP", step: 3 })}
													>
														{t("web.mrSkipPush")}
													</button>
												)}
										</div>
									)}

									{/* ── Step 4: Create MR ── */}
									{s.mrStatus === "idle" && (
										<div>
											<button
												class="action-btn"
												type="button"
												onClick={createMR}
												disabled={!s.targetBranch || !s.mrTitle}
											>
												{s.draft
													? t("web.mrCreateDraftBtn")
													: t("web.mrCreateBtn")}
											</button>
										</div>
									)}
									{s.mrStatus === "running" && (
										<div class="loading-row">
											<span class="spinner" /> {t("web.mrCreatingMR")}
										</div>
									)}
									{(s.mrStatus === "success" || s.mrStatus === "existing") && (
										<div class="result-card result-success">
											<div class="result-label">
												{s.mrStatus === "existing"
													? t("web.mrExistingNote")
													: t("web.mrResultUrl")}
											</div>
											<div class="mr-url-row">
												<a
													class="mr-url-link"
													href={s.mrUrl}
													target="_blank"
													rel="noopener"
												>
													{s.mrUrl}
												</a>
												<button
													class={`copy-btn${s.copied ? " copied" : ""}`}
													type="button"
													onClick={copyMrUrl}
												>
													{s.copied ? t("web.mrCopied") : t("web.mrCopy")}
												</button>
											</div>
										</div>
									)}
									{s.mrStatus === "error" && (
										<div class="result-card result-error">
											<div class="result-text error">{s.mrError}</div>
										</div>
									)}

									{/* ── Step 5: Jira ── */}
									{s.mrUrl && s.ticketKeys.length > 0 && (
										<div>
											{s.ticketKeys.map((key) => (
												<div class="result-card">
													<div class="result-label">
														{t("web.mrStepJira")}: {key}
													</div>
													<button
														class="action-btn secondary"
														type="button"
														onClick={() =>
															addJiraComment(
																key,
																t("web.mrJiraCommentTemplate", {
																	key,
																	mrUrl: s.mrUrl,
																}),
															)
														}
													>
														{t("web.mrJiraCommentBtn")}
													</button>
													<button
														class="action-btn secondary"
														type="button"
														onClick={() => loadJiraTransitions(key)}
													>
														{t("web.mrJiraTransitionBtn")}
													</button>
													{s.jiraTransitions[key] && (
														<div style="margin-top: 8px;">
															{s.jiraTransitions[key].map((tr) => (
																<button
																	class="action-btn secondary"
																	type="button"
																	onClick={() => transitionJira(key, tr.id)}
																	style="margin-bottom: 4px"
																>
																	{tr.name}
																</button>
															))}
														</div>
													)}
													{s.jiraResults[key] === "success" && (
														<span class="result-badge">
															{t("web.executeSuccess")}
														</span>
													)}
													{s.jiraResults[key] === "error" && (
														<span style="color: var(--error); font-size: 12px">
															{t("web.executeFailed")}
														</span>
													)}
												</div>
											))}
										</div>
									)}
									{s.mrUrl && s.ticketKeys.length === 0 && (
										<div class="result-card">
											<div class="result-text">{t("web.mrNoTickets")}</div>
										</div>
									)}
								</>
							)}
						</>
					)}
				</>
			)}

			{/* ── Remote mode ── */}
			{s.mode === "remote" && (
				<>
					<div class="remote-hint">{t("web.mrRemoteModeHint")}</div>

					{s.error && <div class="result-card result-error">{s.error}</div>}

					{/* ── History exists: show history + new button (modal for creation) ── */}
					{s.history.length > 0 && !s.modalOpen && (
						<div class="history-section">
							<div class="history-header">
								<h3>{t("web.mrHistoryTitle")}</h3>
								{s.clearConfirm ? (
									<div style="display:flex;align-items:center;gap:8px">
										<span style="font-size:12px;color:var(--text-3)">
											{t("web.clearConfirm")}
										</span>
										<button
											class="history-clear"
											type="button"
											style="border-color:var(--error);color:var(--error)"
											onClick={clearHistory}
										>
											{t("web.clearHistory")}
										</button>
										<button
											class="history-clear"
											type="button"
											onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
										>
											{t("web.cancel")}
										</button>
									</div>
								) : (
									<button
										class="history-clear"
										type="button"
										onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
									>
										{t("web.clearHistory")}
									</button>
								)}
							</div>
							{s.history.map((entry: MrHistoryEntry) => (
								<div class="history-item">
									<div class="history-info">
										<div class="history-title">
											{entry.title ||
												`${entry.sourceBranch} → ${entry.targetBranch}`}
										</div>
										<div class="history-branches">
											{entry.sourceBranch} → {entry.targetBranch}
										</div>
										<div class="history-sub">
											{entry.projectName} · {entry.createdAt}
										</div>
									</div>
									<div class="history-actions">
										<button
											class="history-exec-btn"
											type="button"
											onClick={() => executeHistory(entry)}
										>
											{t("web.quickExecute")}
										</button>
									</div>
								</div>
							))}
						</div>
					)}

					{s.quickExecuting && (
						<div class="loading-row">
							<span class="spinner" /> {t("web.mrCreatingMR")}
						</div>
					)}

					{(s.mrStatus === "success" || s.mrStatus === "existing") &&
						!s.modalOpen && (
							<div class="result-card result-success">
								<div class="result-label">
									{s.mrStatus === "existing"
										? t("web.mrExistingNote")
										: t("web.mrResultUrl")}
								</div>
								<div class="mr-url-row">
									<a
										class="mr-url-link"
										href={s.mrUrl}
										target="_blank"
										rel="noopener"
									>
										{s.mrUrl}
									</a>
									<button
										class={`copy-btn${s.copied ? " copied" : ""}`}
										type="button"
										onClick={copyMrUrl}
									>
										{s.copied ? t("web.mrCopied") : t("web.mrCopy")}
									</button>
								</div>
							</div>
						)}

					{s.history.length > 0 && !s.modalOpen && !s.quickExecuting && (
						<button
							class="new-mr-btn"
							type="button"
							onClick={() => d({ type: "TOGGLE_MODAL", open: true })}
						>
							{t("web.mrNewBtn")}
						</button>
					)}

					{/* ── No history: show inline create flow ── */}
					{s.history.length === 0 && !s.modalOpen && !s.quickExecuting && (
						<>
							<Pipeline steps={pipelineSteps} />

							{/* ── Step 0: Project Selection ── */}
							<div class="sel" style={`z-index:${s.projectOpen ? 100 : 1}`}>
								<button
									class={`sel-trigger${s.projectOpen ? " open" : ""}`}
									type="button"
									role="combobox"
									aria-expanded={s.projectOpen}
									onClick={() => openProject(!s.projectOpen)}
								>
									<span class="sel-trigger-label">{t("web.projectLabel")}</span>
									<span
										class={`sel-trigger-value${s.projectId ? "" : " empty"}`}
									>
										{s.projectId ? s.projectName : t("web.mrSelectProject")}
									</span>
									<span class="sel-trigger-arrow">▼</span>
								</button>
								{s.projectOpen && (
									<div class="sel-dropdown" role="listbox">
										<div class="sel-search">
											<input
												ref={projectSearchRef}
												class="sel-search-input"
												type="text"
												placeholder={t("web.mrSearchProject")}
												value={s.projectSearch}
												onInput={(e: Event) =>
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
															if (p) {
																d({
																	type: "SELECT_REMOTE_PROJECT",
																	projectId: p.id,
																	projectName: p.name,
																	projectPath: p.pathWithNamespace,
																});
																loadRemoteBranches(p.id);
																loadMembers();
															}
														},
														() => openProject(false),
													);
													if (n !== undefined)
														d({ type: "SET_PROJECT_INDEX", index: n });
												}}
											/>
										</div>
										{s.projectsLoading ? (
											<div class="sel-empty">
												<span class="spinner" /> {t("web.mrLoadingProjects")}
											</div>
										) : fp.length > 0 ? (
											fp.map((p, i) => (
												<div
													class={`sel-item${p.id === s.projectId ? " active" : ""}${i === s.projectIndex ? " highlighted" : ""}`}
													onMouseEnter={() =>
														d({ type: "SET_PROJECT_INDEX", index: i })
													}
													onClick={() => {
														d({
															type: "SELECT_REMOTE_PROJECT",
															projectId: p.id,
															projectName: p.name,
															projectPath: p.pathWithNamespace,
														});
														loadRemoteBranches(p.id);
														loadMembers();
													}}
												>
													<div class="sel-item-name">{p.name}</div>
													<div class="sel-item-sub">{p.pathWithNamespace}</div>
												</div>
											))
										) : (
											<div class="sel-empty">{t("web.mrNoProjects")}</div>
										)}
									</div>
								)}
							</div>

							{/* ── Step 1: Branches ── */}
							{s.projectId > 0 && (
								<div>
									{/* Source branch selector */}
									<div
										class="sel"
										style={`z-index:${s.sourceBranchOpen ? 200 : 1}`}
									>
										<button
											class={`sel-trigger${s.sourceBranchOpen ? " open" : ""}`}
											type="button"
											role="combobox"
											aria-expanded={s.sourceBranchOpen}
											onClick={() => {
												openSourceBranch(!s.sourceBranchOpen);
												if (!s.remoteBranches.length) loadRemoteBranches();
											}}
										>
											<span class="sel-trigger-label">
												{t("web.mrFromBranch")}
											</span>
											<span
												class={`sel-trigger-value${s.sourceBranch ? "" : " empty"}`}
											>
												{s.sourceBranch || t("web.mrSelectFrom")}
											</span>
											<span class="sel-trigger-arrow">▼</span>
										</button>
										{s.sourceBranchOpen && (
											<div class="sel-dropdown" role="listbox">
												<div class="sel-search">
													<input
														ref={sourceBranchSearchRef}
														class="sel-search-input"
														type="text"
														placeholder={t("web.mrFilterFrom")}
														value={s.sourceBranchSearch}
														onInput={(e: Event) =>
															d({
																type: "SET_SOURCE_BRANCH_SEARCH",
																search: (e.target as HTMLInputElement).value,
															})
														}
														onKeyDown={(e: KeyboardEvent) => {
															const n = selKeyDown(
																e,
																s.sourceBranchOpen,
																fsb.length,
																s.sourceBranchIndex,
																(i) => {
																	const b = fsb[i];
																	if (b)
																		d({
																			type: "SELECT_SOURCE_BRANCH",
																			branch: b.name,
																		});
																},
																() => openSourceBranch(false),
															);
															if (n !== undefined)
																d({
																	type: "SET_SOURCE_BRANCH_INDEX",
																	index: n,
																});
														}}
													/>
												</div>
												{s.remoteBranchesLoading ? (
													<div class="sel-empty">
														<span class="spinner" /> {t("web.mrLoadingTarget")}
													</div>
												) : fsb.length > 0 ? (
													fsb.map((b, i) => (
														<div
															class={`sel-item${b.name === s.sourceBranch ? " active" : ""}${i === s.sourceBranchIndex ? " highlighted" : ""}`}
															onMouseEnter={() =>
																d({ type: "SET_SOURCE_BRANCH_INDEX", index: i })
															}
															onClick={() =>
																d({
																	type: "SELECT_SOURCE_BRANCH",
																	branch: b.name,
																})
															}
														>
															<span class="sel-item-name">{b.name}</span>
															{b.default && (
																<span class="result-badge">
																	{t("web.defaultBranch")}
																</span>
															)}
														</div>
													))
												) : (
													<div class="sel-empty">{t("web.mrNoTarget")}</div>
												)}
											</div>
										)}
									</div>

									{/* Target branch selector */}
									<div class="sel" style={`z-index:${s.branchOpen ? 100 : 1}`}>
										<button
											class={`sel-trigger${s.branchOpen ? " open" : ""}`}
											type="button"
											role="combobox"
											aria-expanded={s.branchOpen}
											onClick={() => {
												openBranch(!s.branchOpen);
												if (!s.remoteBranches.length) loadRemoteBranches();
											}}
										>
											<span class="sel-trigger-label">
												{t("web.mrIntoBranch")}
											</span>
											<span
												class={`sel-trigger-value${s.targetBranch ? "" : " empty"}`}
											>
												{s.targetBranch || t("web.mrSelectInto")}
											</span>
											<span class="sel-trigger-arrow">▼</span>
										</button>
										{s.branchOpen && (
											<div class="sel-dropdown" role="listbox">
												<div class="sel-search">
													<input
														ref={branchSearchRef}
														class="sel-search-input"
														type="text"
														placeholder={t("web.mrFilterInto")}
														value={s.branchSearch}
														onInput={(e: Event) =>
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
																			branch: b.name,
																		});
																},
																() => openBranch(false),
															);
															if (n !== undefined)
																d({ type: "SET_BRANCH_INDEX", index: n });
														}}
													/>
												</div>
												{s.remoteBranchesLoading ? (
													<div class="sel-empty">
														<span class="spinner" /> {t("web.mrLoadingTarget")}
													</div>
												) : fb.length > 0 ? (
													fb.map((b, i) => (
														<div
															class={`sel-item${b.name === s.targetBranch ? " active" : ""}${i === s.branchIndex ? " highlighted" : ""}`}
															onMouseEnter={() =>
																d({ type: "SET_BRANCH_INDEX", index: i })
															}
															onClick={() =>
																d({
																	type: "SELECT_TARGET_BRANCH",
																	branch: b.name,
																})
															}
														>
															<span class="sel-item-name">{b.name}</span>
															{b.default && (
																<span class="result-badge">
																	{t("web.defaultBranch")}
																</span>
															)}
														</div>
													))
												) : (
													<div class="sel-empty">{t("web.mrNoTarget")}</div>
												)}
											</div>
										)}
									</div>
								</div>
							)}

							{/* ── Step 2: Title & Description ── */}
							{s.sourceBranch && s.targetBranch && (
								<div>
									<div class="input-label">{t("web.mrTitleLabel")}</div>
									<input
										class="title-input"
										type="text"
										placeholder={t("web.mrEnterTitle")}
										value={s.mrTitle}
										onInput={(e: Event) =>
											d({
												type: "SET_MR_TITLE",
												title: (e.target as HTMLInputElement).value,
											})
										}
									/>
									<div class="input-label">{t("web.mrDescriptionLabel")}</div>
									<textarea
										class="desc-input"
										placeholder={t("web.mrEnterDescription")}
										value={s.mrDescription}
										rows={4}
										onInput={(e: Event) =>
											d({
												type: "SET_MR_DESC",
												description: (e.target as HTMLInputElement).value,
											})
										}
									/>

									{/* Reviewer selector */}
									<div class="sel" style={`z-index:${s.memberOpen ? 100 : 1}`}>
										<button
											class={`sel-trigger${s.memberOpen ? " open" : ""}`}
											type="button"
											role="combobox"
											aria-expanded={s.memberOpen}
											onClick={() => {
												openMember(!s.memberOpen);
												if (!s.members.length && s.projectId) loadMembers();
											}}
										>
											<span class="sel-trigger-label">
												{t("web.mrReviewerLabel")}
											</span>
											<span
												class={`sel-trigger-value${s.reviewerId ? "" : " empty"}`}
											>
												{s.reviewerId
													? s.reviewerName
													: t("web.mrSkipReviewer")}
											</span>
											<span class="sel-trigger-arrow">▼</span>
										</button>
										{s.memberOpen && (
											<div class="sel-dropdown" role="listbox">
												<div class="sel-search">
													<input
														ref={memberSearchRef}
														class="sel-search-input"
														type="text"
														placeholder={t("web.mrFilterReviewer")}
														value={s.memberSearch}
														onInput={(e: Event) =>
															d({
																type: "SET_MEMBER_SEARCH",
																search: (e.target as HTMLInputElement).value,
															})
														}
														onKeyDown={(e: KeyboardEvent) => {
															const n = selKeyDown(
																e,
																s.memberOpen,
																fm.length,
																s.memberIndex,
																(i) => {
																	const m = fm[i];
																	if (m)
																		d({
																			type: "SELECT_REVIEWER",
																			id: m.id,
																			name: `${m.name} (@${m.username})`,
																		});
																},
																() => openMember(false),
															);
															if (n !== undefined)
																d({ type: "SET_MEMBER_INDEX", index: n });
														}}
													/>
												</div>
												<div
													class={`sel-item${!s.reviewerId ? " active" : ""}`}
													onClick={() =>
														d({ type: "SELECT_REVIEWER", id: 0, name: "" })
													}
												>
													<span class="sel-item-name">
														{t("web.mrSkipReviewer")}
													</span>
												</div>
												{s.membersLoading ? (
													<div class="sel-empty">
														<span class="spinner" />{" "}
														{t("web.mrLoadingReviewer")}
													</div>
												) : fm.length > 0 ? (
													fm.map((m, i) => (
														<div
															class={`sel-item${m.id === s.reviewerId ? " active" : ""}${i === s.memberIndex ? " highlighted" : ""}`}
															onMouseEnter={() =>
																d({ type: "SET_MEMBER_INDEX", index: i })
															}
															onClick={() =>
																d({
																	type: "SELECT_REVIEWER",
																	id: m.id,
																	name: `${m.name} (@${m.username})`,
																})
															}
														>
															<div class="sel-item-name">{m.name}</div>
															<div class="sel-item-sub">@{m.username}</div>
														</div>
													))
												) : (
													<div class="sel-empty">{t("web.mrNoReviewer")}</div>
												)}
											</div>
										)}
									</div>

									{/* Draft toggle */}
									<div
										class="draft-toggle"
										onClick={() => d({ type: "SET_DRAFT", draft: !s.draft })}
									>
										<div
											class={`draft-toggle-check${s.draft ? " active" : ""}`}
										>
											{s.draft && "✓"}
										</div>
										<span class="draft-toggle-label">
											{t("web.mrDraftToggle")}
										</span>
									</div>
								</div>
							)}

							{/* ── Step 3: Create MR ── */}
							{s.mrStatus === "idle" && (
								<div>
									<button
										class="action-btn"
										type="button"
										onClick={createMR}
										disabled={!s.sourceBranch || !s.targetBranch || !s.mrTitle}
									>
										{s.draft ? t("web.mrCreateDraftBtn") : t("web.mrCreateBtn")}
									</button>
								</div>
							)}
							{s.mrStatus === "running" && (
								<div class="loading-row">
									<span class="spinner" /> {t("web.mrCreatingMR")}
								</div>
							)}
							{(s.mrStatus === "success" || s.mrStatus === "existing") && (
								<div class="result-card result-success">
									<div class="result-label">
										{s.mrStatus === "existing"
											? t("web.mrExistingNote")
											: t("web.mrResultUrl")}
									</div>
									<div class="mr-url-row">
										<a
											class="mr-url-link"
											href={s.mrUrl}
											target="_blank"
											rel="noopener"
										>
											{s.mrUrl}
										</a>
										<button
											class={`copy-btn${s.copied ? " copied" : ""}`}
											type="button"
											onClick={copyMrUrl}
										>
											{s.copied ? t("web.mrCopied") : t("web.mrCopy")}
										</button>
									</div>
								</div>
							)}
							{s.mrStatus === "error" && (
								<div class="result-card result-error">
									<div class="result-text error">{s.mrError}</div>
								</div>
							)}

							{/* ── Step 4: Jira ── */}
							{s.mrUrl && s.ticketKeys.length > 0 && (
								<div>
									{s.ticketKeys.map((key) => (
										<div class="result-card">
											<div class="result-label">
												{t("web.mrStepJira")}: {key}
											</div>
											<button
												class="action-btn secondary"
												type="button"
												onClick={() =>
													addJiraComment(
														key,
														t("web.mrJiraCommentTemplate", {
															key,
															mrUrl: s.mrUrl,
														}),
													)
												}
											>
												{t("web.mrJiraCommentBtn")}
											</button>
											<button
												class="action-btn secondary"
												type="button"
												onClick={() => loadJiraTransitions(key)}
											>
												{t("web.mrJiraTransitionBtn")}
											</button>
											{s.jiraTransitions[key] && (
												<div style="margin-top: 8px;">
													{s.jiraTransitions[key].map((tr) => (
														<button
															class="action-btn secondary"
															type="button"
															onClick={() => transitionJira(key, tr.id)}
															style="margin-bottom: 4px"
														>
															{tr.name}
														</button>
													))}
												</div>
											)}
											{s.jiraResults[key] === "success" && (
												<span class="result-badge">
													{t("web.executeSuccess")}
												</span>
											)}
											{s.jiraResults[key] === "error" && (
												<span style="color: var(--error); font-size: 12px">
													{t("web.executeFailed")}
												</span>
											)}
										</div>
									))}
								</div>
							)}
						</>
					)}
				</>
			)}

			{/* ── Modal: New MR creation ── */}
			{s.modalOpen && (
				<div
					class="modal-overlay"
					onClick={(e: Event) => {
						if ((e.target as HTMLElement).classList.contains("modal-overlay"))
							d({ type: "TOGGLE_MODAL", open: false });
					}}
				>
					<div class="modal-box">
						<div class="modal-header">
							<h3>{t("web.mrNewModalTitle")}</h3>
							<button
								class="modal-close"
								type="button"
								onClick={() => d({ type: "TOGGLE_MODAL", open: false })}
							>
								×
							</button>
						</div>

						{/* ── Modal create flow for local mode ── */}
						{s.mode === "local" && s.currentBranch && (
							<>
								<Pipeline steps={pipelineSteps} />

								<div>
									<div class="result-card">
										<div class="result-label">{t("web.mrFromBranch")}</div>
										<div class="result-text success">{s.currentBranch}</div>
										{s.detectedSource && (
											<span class="result-badge">
												{t("web.mrDetectSource")}: {s.detectedSource}
											</span>
										)}
									</div>

									{/* Target branch selector */}
									<div class="sel" style={`z-index:${s.branchOpen ? 100 : 1}`}>
										<button
											class={`sel-trigger${s.branchOpen ? " open" : ""}`}
											type="button"
											role="combobox"
											aria-expanded={s.branchOpen}
											onClick={() => {
												openBranch(!s.branchOpen);
												if (!s.remoteBranches.length && s.projectId)
													loadRemoteBranches();
											}}
										>
											<span class="sel-trigger-label">
												{t("web.mrIntoBranch")}
											</span>
											<span
												class={`sel-trigger-value${s.targetBranch ? "" : " empty"}`}
											>
												{s.targetBranch || t("web.mrSelectInto")}
											</span>
											<span class="sel-trigger-arrow">▼</span>
										</button>
										{s.branchOpen && (
											<div class="sel-dropdown" role="listbox">
												<div class="sel-search">
													<input
														ref={branchSearchRef}
														class="sel-search-input"
														type="text"
														placeholder={t("web.mrFilterInto")}
														value={s.branchSearch}
														onInput={(e: Event) =>
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
																			branch: b.name,
																		});
																},
																() => openBranch(false),
															);
															if (n !== undefined)
																d({ type: "SET_BRANCH_INDEX", index: n });
														}}
													/>
												</div>
												{s.remoteBranchesLoading ? (
													<div class="sel-empty">
														<span class="spinner" /> {t("web.mrLoadingTarget")}
													</div>
												) : fb.length > 0 ? (
													fb.map((b, i) => (
														<div
															class={`sel-item${b.name === s.targetBranch ? " active" : ""}${i === s.branchIndex ? " highlighted" : ""}`}
															onMouseEnter={() =>
																d({ type: "SET_BRANCH_INDEX", index: i })
															}
															onClick={() =>
																d({
																	type: "SELECT_TARGET_BRANCH",
																	branch: b.name,
																})
															}
														>
															<span class="sel-item-name">{b.name}</span>
															{b.default && (
																<span class="result-badge">
																	{t("web.defaultBranch")}
																</span>
															)}
														</div>
													))
												) : (
													<div class="sel-empty">{t("web.mrNoTarget")}</div>
												)}
											</div>
										)}
									</div>
								</div>

								{s.targetBranch && (
									<div>
										<div class="input-label">{t("web.mrTitleLabel")}</div>
										<input
											class="title-input"
											type="text"
											placeholder={t("web.mrEnterTitle")}
											value={s.mrTitle}
											onInput={(e: Event) =>
												d({
													type: "SET_MR_TITLE",
													title: (e.target as HTMLInputElement).value,
												})
											}
										/>
										<div class="input-label">{t("web.mrDescriptionLabel")}</div>
										<textarea
											class="desc-input"
											placeholder={t("web.mrEnterDescription")}
											value={s.mrDescription}
											rows={4}
											onInput={(e: Event) =>
												d({
													type: "SET_MR_DESC",
													description: (e.target as HTMLInputElement).value,
												})
											}
										/>

										{/* Reviewer selector */}
										<div
											class="sel"
											style={`z-index:${s.memberOpen ? 100 : 1}`}
										>
											<button
												class={`sel-trigger${s.memberOpen ? " open" : ""}`}
												type="button"
												role="combobox"
												aria-expanded={s.memberOpen}
												onClick={() => {
													openMember(!s.memberOpen);
													if (!s.members.length && s.projectId) loadMembers();
												}}
											>
												<span class="sel-trigger-label">
													{t("web.mrReviewerLabel")}
												</span>
												<span
													class={`sel-trigger-value${s.reviewerId ? "" : " empty"}`}
												>
													{s.reviewerId
														? s.reviewerName
														: t("web.mrSkipReviewer")}
												</span>
												<span class="sel-trigger-arrow">▼</span>
											</button>
											{s.memberOpen && (
												<div class="sel-dropdown" role="listbox">
													<div class="sel-search">
														<input
															ref={memberSearchRef}
															class="sel-search-input"
															type="text"
															placeholder={t("web.mrFilterReviewer")}
															value={s.memberSearch}
															onInput={(e: Event) =>
																d({
																	type: "SET_MEMBER_SEARCH",
																	search: (e.target as HTMLInputElement).value,
																})
															}
															onKeyDown={(e: KeyboardEvent) => {
																const n = selKeyDown(
																	e,
																	s.memberOpen,
																	fm.length,
																	s.memberIndex,
																	(i) => {
																		const m = fm[i];
																		if (m)
																			d({
																				type: "SELECT_REVIEWER",
																				id: m.id,
																				name: `${m.name} (@${m.username})`,
																			});
																	},
																	() => openMember(false),
																);
																if (n !== undefined)
																	d({ type: "SET_MEMBER_INDEX", index: n });
															}}
														/>
													</div>
													<div
														class={`sel-item${!s.reviewerId ? " active" : ""}`}
														onClick={() =>
															d({ type: "SELECT_REVIEWER", id: 0, name: "" })
														}
													>
														<span class="sel-item-name">
															{t("web.mrSkipReviewer")}
														</span>
													</div>
													{s.membersLoading ? (
														<div class="sel-empty">
															<span class="spinner" />{" "}
															{t("web.mrLoadingReviewer")}
														</div>
													) : fm.length > 0 ? (
														fm.map((m, i) => (
															<div
																class={`sel-item${m.id === s.reviewerId ? " active" : ""}${i === s.memberIndex ? " highlighted" : ""}`}
																onMouseEnter={() =>
																	d({ type: "SET_MEMBER_INDEX", index: i })
																}
																onClick={() =>
																	d({
																		type: "SELECT_REVIEWER",
																		id: m.id,
																		name: `${m.name} (@${m.username})`,
																	})
																}
															>
																<div class="sel-item-name">{m.name}</div>
																<div class="sel-item-sub">@{m.username}</div>
															</div>
														))
													) : (
														<div class="sel-empty">{t("web.mrNoReviewer")}</div>
													)}
												</div>
											)}
										</div>

										{/* Draft toggle */}
										<div
											class="draft-toggle"
											onClick={() => d({ type: "SET_DRAFT", draft: !s.draft })}
										>
											<div
												class={`draft-toggle-check${s.draft ? " active" : ""}`}
											>
												{s.draft && "✓"}
											</div>
											<span class="draft-toggle-label">
												{t("web.mrDraftToggle")}
											</span>
										</div>
									</div>
								)}

								{/* Push */}
								{s.targetBranch && (
									<div>
										{s.pushStatus === "idle" && (
											<button
												class="action-btn"
												type="button"
												onClick={pushBranch}
											>
												{t("web.mrPushBtn")}
											</button>
										)}
										{s.pushStatus === "running" && (
											<div class="loading-row">
												<span class="spinner" /> {t("web.mrPushing")}
											</div>
										)}
										{s.pushStatus === "success" && (
											<div class="result-card result-success">
												<div class="result-label">{t("web.mrPushBtn")}</div>
												<div class="result-text success">
													{t("web.mrPushSuccess")}
												</div>
											</div>
										)}
										{s.pushStatus === "error" && (
											<div class="result-card result-error">
												<div class="result-text error">
													{t("web.mrPushFailed")}
												</div>
											</div>
										)}
										{s.pushStatus !== "success" &&
											s.pushStatus !== "running" && (
												<button
													class="action-btn secondary"
													type="button"
													onClick={() => d({ type: "SET_STEP", step: 3 })}
												>
													{t("web.mrSkipPush")}
												</button>
											)}
									</div>
								)}

								{/* Create MR */}
								{s.mrStatus === "idle" && (
									<div>
										<button
											class="action-btn"
											type="button"
											onClick={createMR}
											disabled={!s.targetBranch || !s.mrTitle}
										>
											{s.draft
												? t("web.mrCreateDraftBtn")
												: t("web.mrCreateBtn")}
										</button>
									</div>
								)}
								{s.mrStatus === "running" && (
									<div class="loading-row">
										<span class="spinner" /> {t("web.mrCreatingMR")}
									</div>
								)}
								{(s.mrStatus === "success" || s.mrStatus === "existing") && (
									<div class="result-card result-success">
										<div class="result-label">
											{s.mrStatus === "existing"
												? t("web.mrExistingNote")
												: t("web.mrResultUrl")}
										</div>
										<div class="mr-url-row">
											<a
												class="mr-url-link"
												href={s.mrUrl}
												target="_blank"
												rel="noopener"
											>
												{s.mrUrl}
											</a>
											<button
												class={`copy-btn${s.copied ? " copied" : ""}`}
												type="button"
												onClick={copyMrUrl}
											>
												{s.copied ? t("web.mrCopied") : t("web.mrCopy")}
											</button>
										</div>
									</div>
								)}
								{s.mrStatus === "error" && (
									<div class="result-card result-error">
										<div class="result-text error">{s.mrError}</div>
									</div>
								)}
							</>
						)}

						{/* ── Modal create flow for remote mode ── */}
						{s.mode === "remote" && (
							<>
								<Pipeline steps={pipelineSteps} />

								{/* Project selector */}
								<div class="sel" style={`z-index:${s.projectOpen ? 100 : 1}`}>
									<button
										class={`sel-trigger${s.projectOpen ? " open" : ""}`}
										type="button"
										role="combobox"
										aria-expanded={s.projectOpen}
										onClick={() => openProject(!s.projectOpen)}
									>
										<span class="sel-trigger-label">
											{t("web.projectLabel")}
										</span>
										<span
											class={`sel-trigger-value${s.projectId ? "" : " empty"}`}
										>
											{s.projectId ? s.projectName : t("web.mrSelectProject")}
										</span>
										<span class="sel-trigger-arrow">▼</span>
									</button>
									{s.projectOpen && (
										<div class="sel-dropdown" role="listbox">
											<div class="sel-search">
												<input
													ref={projectSearchRef}
													class="sel-search-input"
													type="text"
													placeholder={t("web.mrSearchProject")}
													value={s.projectSearch}
													onInput={(e: Event) =>
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
																if (p) {
																	d({
																		type: "SELECT_REMOTE_PROJECT",
																		projectId: p.id,
																		projectName: p.name,
																		projectPath: p.pathWithNamespace,
																	});
																	loadRemoteBranches(p.id);
																	loadMembers();
																}
															},
															() => openProject(false),
														);
														if (n !== undefined)
															d({ type: "SET_PROJECT_INDEX", index: n });
													}}
												/>
											</div>
											{s.projectsLoading ? (
												<div class="sel-empty">
													<span class="spinner" /> {t("web.mrLoadingProjects")}
												</div>
											) : fp.length > 0 ? (
												fp.map((p, i) => (
													<div
														class={`sel-item${p.id === s.projectId ? " active" : ""}${i === s.projectIndex ? " highlighted" : ""}`}
														onMouseEnter={() =>
															d({ type: "SET_PROJECT_INDEX", index: i })
														}
														onClick={() => {
															d({
																type: "SELECT_REMOTE_PROJECT",
																projectId: p.id,
																projectName: p.name,
																projectPath: p.pathWithNamespace,
															});
															loadRemoteBranches(p.id);
															loadMembers();
														}}
													>
														<div class="sel-item-name">{p.name}</div>
														<div class="sel-item-sub">
															{p.pathWithNamespace}
														</div>
													</div>
												))
											) : (
												<div class="sel-empty">{t("web.mrNoProjects")}</div>
											)}
										</div>
									)}
								</div>

								{/* Branches */}
								{s.projectId > 0 && (
									<div>
										{/* Source branch */}
										<div
											class="sel"
											style={`z-index:${s.sourceBranchOpen ? 200 : 1}`}
										>
											<button
												class={`sel-trigger${s.sourceBranchOpen ? " open" : ""}`}
												type="button"
												role="combobox"
												aria-expanded={s.sourceBranchOpen}
												onClick={() => {
													openSourceBranch(!s.sourceBranchOpen);
													if (!s.remoteBranches.length) loadRemoteBranches();
												}}
											>
												<span class="sel-trigger-label">
													{t("web.mrFromBranch")}
												</span>
												<span
													class={`sel-trigger-value${s.sourceBranch ? "" : " empty"}`}
												>
													{s.sourceBranch || t("web.mrSelectFrom")}
												</span>
												<span class="sel-trigger-arrow">▼</span>
											</button>
											{s.sourceBranchOpen && (
												<div class="sel-dropdown" role="listbox">
													<div class="sel-search">
														<input
															ref={sourceBranchSearchRef}
															class="sel-search-input"
															type="text"
															placeholder={t("web.mrFilterFrom")}
															value={s.sourceBranchSearch}
															onInput={(e: Event) =>
																d({
																	type: "SET_SOURCE_BRANCH_SEARCH",
																	search: (e.target as HTMLInputElement).value,
																})
															}
															onKeyDown={(e: KeyboardEvent) => {
																const n = selKeyDown(
																	e,
																	s.sourceBranchOpen,
																	fsb.length,
																	s.sourceBranchIndex,
																	(i) => {
																		const b = fsb[i];
																		if (b)
																			d({
																				type: "SELECT_SOURCE_BRANCH",
																				branch: b.name,
																			});
																	},
																	() => openSourceBranch(false),
																);
																if (n !== undefined)
																	d({
																		type: "SET_SOURCE_BRANCH_INDEX",
																		index: n,
																	});
															}}
														/>
													</div>
													{s.remoteBranchesLoading ? (
														<div class="sel-empty">
															<span class="spinner" />{" "}
															{t("web.mrLoadingTarget")}
														</div>
													) : fsb.length > 0 ? (
														fsb.map((b, i) => (
															<div
																class={`sel-item${b.name === s.sourceBranch ? " active" : ""}${i === s.sourceBranchIndex ? " highlighted" : ""}`}
																onMouseEnter={() =>
																	d({
																		type: "SET_SOURCE_BRANCH_INDEX",
																		index: i,
																	})
																}
																onClick={() =>
																	d({
																		type: "SELECT_SOURCE_BRANCH",
																		branch: b.name,
																	})
																}
															>
																<span class="sel-item-name">{b.name}</span>
																{b.default && (
																	<span class="result-badge">
																		{t("web.defaultBranch")}
																	</span>
																)}
															</div>
														))
													) : (
														<div class="sel-empty">{t("web.mrNoTarget")}</div>
													)}
												</div>
											)}
										</div>

										{/* Target branch */}
										<div
											class="sel"
											style={`z-index:${s.branchOpen ? 100 : 1}`}
										>
											<button
												class={`sel-trigger${s.branchOpen ? " open" : ""}`}
												type="button"
												role="combobox"
												aria-expanded={s.branchOpen}
												onClick={() => {
													openBranch(!s.branchOpen);
													if (!s.remoteBranches.length) loadRemoteBranches();
												}}
											>
												<span class="sel-trigger-label">
													{t("web.mrIntoBranch")}
												</span>
												<span
													class={`sel-trigger-value${s.targetBranch ? "" : " empty"}`}
												>
													{s.targetBranch || t("web.mrSelectInto")}
												</span>
												<span class="sel-trigger-arrow">▼</span>
											</button>
											{s.branchOpen && (
												<div class="sel-dropdown" role="listbox">
													<div class="sel-search">
														<input
															ref={branchSearchRef}
															class="sel-search-input"
															type="text"
															placeholder={t("web.mrFilterInto")}
															value={s.branchSearch}
															onInput={(e: Event) =>
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
																				branch: b.name,
																			});
																	},
																	() => openBranch(false),
																);
																if (n !== undefined)
																	d({ type: "SET_BRANCH_INDEX", index: n });
															}}
														/>
													</div>
													{s.remoteBranchesLoading ? (
														<div class="sel-empty">
															<span class="spinner" />{" "}
															{t("web.mrLoadingTarget")}
														</div>
													) : fb.length > 0 ? (
														fb.map((b, i) => (
															<div
																class={`sel-item${b.name === s.targetBranch ? " active" : ""}${i === s.branchIndex ? " highlighted" : ""}`}
																onMouseEnter={() =>
																	d({ type: "SET_BRANCH_INDEX", index: i })
																}
																onClick={() =>
																	d({
																		type: "SELECT_TARGET_BRANCH",
																		branch: b.name,
																	})
																}
															>
																<span class="sel-item-name">{b.name}</span>
																{b.default && (
																	<span class="result-badge">
																		{t("web.defaultBranch")}
																	</span>
																)}
															</div>
														))
													) : (
														<div class="sel-empty">{t("web.mrNoTarget")}</div>
													)}
												</div>
											)}
										</div>
									</div>
								)}

								{/* Title & Description */}
								{s.sourceBranch && s.targetBranch && (
									<div>
										<div class="input-label">{t("web.mrTitleLabel")}</div>
										<input
											class="title-input"
											type="text"
											placeholder={t("web.mrEnterTitle")}
											value={s.mrTitle}
											onInput={(e: Event) =>
												d({
													type: "SET_MR_TITLE",
													title: (e.target as HTMLInputElement).value,
												})
											}
										/>
										<div class="input-label">{t("web.mrDescriptionLabel")}</div>
										<textarea
											class="desc-input"
											placeholder={t("web.mrEnterDescription")}
											value={s.mrDescription}
											rows={4}
											onInput={(e: Event) =>
												d({
													type: "SET_MR_DESC",
													description: (e.target as HTMLInputElement).value,
												})
											}
										/>

										{/* Reviewer */}
										<div
											class="sel"
											style={`z-index:${s.memberOpen ? 100 : 1}`}
										>
											<button
												class={`sel-trigger${s.memberOpen ? " open" : ""}`}
												type="button"
												role="combobox"
												aria-expanded={s.memberOpen}
												onClick={() => {
													openMember(!s.memberOpen);
													if (!s.members.length && s.projectId) loadMembers();
												}}
											>
												<span class="sel-trigger-label">
													{t("web.mrReviewerLabel")}
												</span>
												<span
													class={`sel-trigger-value${s.reviewerId ? "" : " empty"}`}
												>
													{s.reviewerId
														? s.reviewerName
														: t("web.mrSkipReviewer")}
												</span>
												<span class="sel-trigger-arrow">▼</span>
											</button>
											{s.memberOpen && (
												<div class="sel-dropdown" role="listbox">
													<div class="sel-search">
														<input
															ref={memberSearchRef}
															class="sel-search-input"
															type="text"
															placeholder={t("web.mrFilterReviewer")}
															value={s.memberSearch}
															onInput={(e: Event) =>
																d({
																	type: "SET_MEMBER_SEARCH",
																	search: (e.target as HTMLInputElement).value,
																})
															}
															onKeyDown={(e: KeyboardEvent) => {
																const n = selKeyDown(
																	e,
																	s.memberOpen,
																	fm.length,
																	s.memberIndex,
																	(i) => {
																		const m = fm[i];
																		if (m)
																			d({
																				type: "SELECT_REVIEWER",
																				id: m.id,
																				name: `${m.name} (@${m.username})`,
																			});
																	},
																	() => openMember(false),
																);
																if (n !== undefined)
																	d({ type: "SET_MEMBER_INDEX", index: n });
															}}
														/>
													</div>
													<div
														class={`sel-item${!s.reviewerId ? " active" : ""}`}
														onClick={() =>
															d({ type: "SELECT_REVIEWER", id: 0, name: "" })
														}
													>
														<span class="sel-item-name">
															{t("web.mrSkipReviewer")}
														</span>
													</div>
													{s.membersLoading ? (
														<div class="sel-empty">
															<span class="spinner" />{" "}
															{t("web.mrLoadingReviewer")}
														</div>
													) : fm.length > 0 ? (
														fm.map((m, i) => (
															<div
																class={`sel-item${m.id === s.reviewerId ? " active" : ""}${i === s.memberIndex ? " highlighted" : ""}`}
																onMouseEnter={() =>
																	d({ type: "SET_MEMBER_INDEX", index: i })
																}
																onClick={() =>
																	d({
																		type: "SELECT_REVIEWER",
																		id: m.id,
																		name: `${m.name} (@${m.username})`,
																	})
																}
															>
																<div class="sel-item-name">{m.name}</div>
																<div class="sel-item-sub">@{m.username}</div>
															</div>
														))
													) : (
														<div class="sel-empty">{t("web.mrNoReviewer")}</div>
													)}
												</div>
											)}
										</div>

										{/* Draft toggle */}
										<div
											class="draft-toggle"
											onClick={() => d({ type: "SET_DRAFT", draft: !s.draft })}
										>
											<div
												class={`draft-toggle-check${s.draft ? " active" : ""}`}
											>
												{s.draft && "✓"}
											</div>
											<span class="draft-toggle-label">
												{t("web.mrDraftToggle")}
											</span>
										</div>
									</div>
								)}

								{/* Create MR */}
								{s.mrStatus === "idle" && (
									<div>
										<button
											class="action-btn"
											type="button"
											onClick={createMR}
											disabled={
												!s.sourceBranch || !s.targetBranch || !s.mrTitle
											}
										>
											{s.draft
												? t("web.mrCreateDraftBtn")
												: t("web.mrCreateBtn")}
										</button>
									</div>
								)}
								{s.mrStatus === "running" && (
									<div class="loading-row">
										<span class="spinner" /> {t("web.mrCreatingMR")}
									</div>
								)}
								{(s.mrStatus === "success" || s.mrStatus === "existing") && (
									<div class="result-card result-success">
										<div class="result-label">
											{s.mrStatus === "existing"
												? t("web.mrExistingNote")
												: t("web.mrResultUrl")}
										</div>
										<div class="mr-url-row">
											<a
												class="mr-url-link"
												href={s.mrUrl}
												target="_blank"
												rel="noopener"
											>
												{s.mrUrl}
											</a>
											<button
												class={`copy-btn${s.copied ? " copied" : ""}`}
												type="button"
												onClick={copyMrUrl}
											>
												{s.copied ? t("web.mrCopied") : t("web.mrCopy")}
											</button>
										</div>
									</div>
								)}
								{s.mrStatus === "error" && (
									<div class="result-card result-error">
										<div class="result-text error">{s.mrError}</div>
									</div>
								)}
							</>
						)}

						{/* ── Close modal on MR success ── */}
						{(s.mrStatus === "success" || s.mrStatus === "existing") && (
							<button
								class="action-btn secondary"
								type="button"
								onClick={() => {
									d({ type: "TOGGLE_MODAL", open: false });
									loadHistory();
								}}
							>
								{t("web.cancel")}
							</button>
						)}
					</div>
				</div>
			)}
		</>
	);
};

export const mount = async (el: HTMLElement) => {
	await initPromise;
	render(<MrClient />, el);
};
