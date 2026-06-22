import { type FC, useEffect, useReducer } from "hono/jsx";
import { render } from "hono/jsx/dom";
import {
	CopyButton,
	commonCss,
	LoadingRow,
	PageHeader,
	pageHeaderCss,
	ResultCard,
	ResultText,
} from "../../shared/components/common";
import { Modal, modalCss } from "../../shared/components/modal";
import { Pipeline, pipelineCss } from "../../shared/components/pipeline";
import {
	Select,
	selectCss,
	useClickOutside,
	useDropdown,
} from "../../shared/components/select";
import { initPromise, t } from "../../shared/i18n";

// ── Types ──

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
  ${pageHeaderCss}
  ${modalCss}

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

  .cwd-error { color: var(--error); font-size: 12px; margin-top: 4px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
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
	// Remote-mode: source branch
	sourceBranch: string;
	// Branch (target)
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
	sourceBranch: "",
	targetBranch: "",
	remoteBranches: [],
	remoteBranchesLoading: false,
	projectId: 0,
	projectName: "",
	mrTitle: "",
	mrDescription: "",
	pushStatus: "idle",
	members: [],
	membersLoading: false,
	reviewerId: 0,
	reviewerName: "",
	draft: false,
	mrStatus: "idle",
	mrUrl: "",
	mrIid: 0,
	mrError: "",
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
	| {
			type: "SELECT_REMOTE_PROJECT";
			projectId: number;
			projectName: string;
			projectPath: string;
	  }
	| { type: "SELECT_SOURCE_BRANCH"; branch: string }
	| { type: "SELECT_TARGET_BRANCH"; branch: string }
	| { type: "SET_REMOTE_BRANCHES"; branches: BranchInfo[]; loading: boolean }
	| { type: "SET_PROJECT"; projectId: number; projectName: string }
	| { type: "SET_MR_TITLE"; title: string }
	| { type: "SET_MR_DESC"; description: string }
	| { type: "SET_PUSH_STATUS"; status: string }
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
		case "SELECT_REMOTE_PROJECT":
			return {
				...state,
				projectId: action.projectId,
				projectName: action.projectName,
				projectPath: action.projectPath,
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
		case "SELECT_SOURCE_BRANCH":
			return {
				...state,
				sourceBranch: action.branch,
				step: state.step < 2 && state.targetBranch ? 2 : state.step,
			};
		case "SELECT_TARGET_BRANCH": {
			const branchStep =
				state.mode === "local"
					? Math.max(state.step, 1)
					: Math.max(state.step, state.sourceBranch ? 2 : state.step);
			return {
				...state,
				targetBranch: action.branch,
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

// ── Select items builders ──

const branchItems = (branches: BranchInfo[]) =>
	branches.map((b) => ({ name: b.name, default: b.default ?? false }));

const projectItems = (projects: ProjectInfo[]) =>
	projects.map((p) => ({
		name: p.name,
		id: p.id,
		pathWithNamespace: p.pathWithNamespace,
	}));

const reviewerItems = (
	members: MemberInfo[],
	sentinelName: string,
): (MemberInfo & { name: string })[] => [
	{ name: sentinelName, id: 0, username: "" },
	...members.map((m) => ({ ...m, name: `${m.name} (@${m.username})` })),
];

// ── Component ──

const MrClient: FC = () => {
	const [s, d] = useReducer(reducer, initial);
	const projectDd = useDropdown();
	const sourceBranchDd = useDropdown();
	const branchDd = useDropdown();
	const memberDd = useDropdown();
	useClickOutside(
		[projectDd, sourceBranchDd, branchDd, memberDd],
		["project", "source-branch", "branch", "member"],
	);

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
					const projects = data.map((p: unknown) => {
						const item = p as ProjectInfo;
						return {
							id: item.id ?? 0,
							name: item.name ?? "",
							pathWithNamespace: item.pathWithNamespace ?? "",
							...(item.defaultBranch !== undefined
								? { defaultBranch: item.defaultBranch }
								: {}),
						};
					});
					d({ type: "SET_PROJECTS", projects });
				} else if (data.error) {
					d({ type: "SET_ERROR", error: data.error });
				}
			})
			.catch((e) => d({ type: "SET_ERROR", error: String(e) }));
	}, [s.mode, s.projects.length, s.projectsLoading]);

	// ── API functions ──

	const loadGitStatus = async (overrideCwd?: string) => {
		d({ type: "SET_LOADING", loading: true });
		try {
			const res = await fetch(api("git/status", overrideCwd ?? s.cwd));
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
				await loadGitStatus(s.cwdInput);
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

	const loadMembers = async (projectId?: number) => {
		const pid = projectId ?? s.projectId;
		if (!pid) return;
		d({ type: "SET_MEMBERS", members: [], loading: true });
		try {
			const res = await fetch(`/mr/api/project/${pid}/members`);
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
					projectName: s.projectName,
					projectPath: s.projectPath,
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
			const res = await fetch("/mr/api/history", { method: "DELETE" });
			if (res.ok) d({ type: "CLEAR_HISTORY_DONE" });
		} catch {
			/* delete failed, keep local state */
		}
	};

	const loadJiraTransitions = async (key: string) => {
		d({ type: "SET_JIRA_STATUS", key, status: "loading" });
		try {
			const res = await fetch(
				`/mr/api/jira/transitions?key=${encodeURIComponent(key)}`,
			);
			const data = await res.json();
			if (data.error) {
				d({ type: "SET_JIRA_STATUS", key, status: "error" });
				return;
			}
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

	// ── Reusable branch renderItem ──
	const branchRenderItem = (
		item: { name: string; default?: boolean },
		_isActive: boolean,
	) => (
		<span>
			<span class={`sel-item-name`}>{item.name}</span>
			{item.default && (
				<span class="result-badge">{t("web.defaultBranch")}</span>
			)}
		</span>
	);

	// ── Reusable reviewer renderItem ──
	const memberRenderItem = (
		item: { name: string; id: number; username?: string },
		_isActive: boolean,
	) => {
		if (item.id === 0) {
			return <span class={`sel-item-name`}>{t("web.mrSkipReviewer")}</span>;
		}
		return (
			<span>
				<div class={`sel-item-name`}>{item.name}</div>
				{item.username && <div class="sel-item-sub">@{item.username}</div>}
			</span>
		);
	};

	// ── Reusable project renderItem ──
	const projectRenderItem = (
		item: { name: string; pathWithNamespace?: string },
		_isActive: boolean,
	) => (
		<span>
			<div class={`sel-item-name`}>{item.name}</div>
			{item.pathWithNamespace && (
				<div class="sel-item-sub">{item.pathWithNamespace}</div>
			)}
		</span>
	);

	// ── MR success card ──
	const mrSuccessCard = () => (
		<ResultCard variant={s.mrStatus === "existing" ? "default" : "success"}>
			<div class="result-label">
				{s.mrStatus === "existing"
					? t("web.mrExistingNote")
					: t("web.mrResultUrl")}
			</div>
			<div class="mr-url-row">
				<a class="mr-url-link" href={s.mrUrl} target="_blank" rel="noopener">
					{s.mrUrl}
				</a>
				<CopyButton text={t("web.mrCopy")} copyText={s.mrUrl} />
			</div>
		</ResultCard>
	);

	// ── Jira section ──
	const jiraSection = () => (
		<div>
			{s.ticketKeys.map((key) => (
				<ResultCard key={key}>
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
									key={tr.id}
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
						<span class="result-badge">{t("web.executeSuccess")}</span>
					)}
					{s.jiraResults[key] === "error" && (
						<span style="color: var(--error); font-size: 12px">
							{t("web.executeFailed")}
						</span>
					)}
				</ResultCard>
			))}
		</div>
	);

	// ── History section ──
	const historySection = () => (
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
				<div class="history-item" key={entry.id}>
					<div class="history-info">
						<div class="history-title">
							{entry.title || `${entry.sourceBranch} → ${entry.targetBranch}`}
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
	);

	// ── Draft toggle ──
	const draftToggle = () => (
		<div
			class="draft-toggle"
			onClick={() => d({ type: "SET_DRAFT", draft: !s.draft })}
		>
			<div class={`draft-toggle-check${s.draft ? " active" : ""}`}>
				{s.draft && "✓"}
			</div>
			<span class="draft-toggle-label">{t("web.mrDraftToggle")}</span>
		</div>
	);

	// ── Title + description inputs ──
	const titleDescInputs = () => (
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
		</div>
	);

	// ── Render ──

	return (
		<>
			<style>{mrStyle}</style>

			{/* ── Header ── */}
			<PageHeader title={t("web.mrTitle")} description={t("web.mrDesc")} />

			{s.mode === "undetermined" &&
				(s.error ? (
					<ResultCard variant="error">
						<ResultText variant="error">{s.error}</ResultText>
					</ResultCard>
				) : (
					<LoadingRow text={t("web.loading")} />
				))}

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

					{s.loading && <LoadingRow text={t("web.loading")} />}
					{s.error && (
						<ResultCard variant="error">
							<ResultText variant="error">{s.error}</ResultText>
						</ResultCard>
					)}

					{s.currentBranch && (
						<>
							{/* ── History exists: show history + new button (modal for creation) ── */}
							{s.history.length > 0 && !s.modalOpen && historySection()}

							{s.quickExecuting && <LoadingRow text={t("web.mrCreatingMR")} />}

							{(s.mrStatus === "success" || s.mrStatus === "existing") &&
								!s.modalOpen &&
								mrSuccessCard()}

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
										<ResultCard>
											<div class="result-label">{t("web.mrFromBranch")}</div>
											<ResultText variant="success">
												{s.currentBranch}
											</ResultText>
											{s.detectedSource && (
												<span class="result-badge">
													{t("web.mrDetectSource")}: {s.detectedSource}
												</span>
											)}
										</ResultCard>

										{/* Target branch selector */}
										<Select
											id="branch"
											label={t("web.mrIntoBranch")}
											placeholder={t("web.mrSelectInto")}
											items={branchItems(s.remoteBranches)}
											value={s.targetBranch ? { name: s.targetBranch } : null}
											isEqual={(a, b) => a.name === b.name}
											dropdown={branchDd}
											onSelect={(item) =>
												d({ type: "SELECT_TARGET_BRANCH", branch: item.name })
											}
											onOpen={() => {
												if (!s.remoteBranches.length && s.projectId)
													loadRemoteBranches();
											}}
											renderItem={branchRenderItem}
											searchPlaceholder={t("web.mrFilterInto")}
											emptyText={
												s.remoteBranchesLoading
													? undefined
													: t("web.mrNoTarget")
											}
										/>

										{s.projectId ? (
											<ResultCard>
												<div class="result-label">{t("web.projectLabel")}</div>
												<ResultText variant="success">
													{s.projectName}
												</ResultText>
											</ResultCard>
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
											{titleDescInputs()}

											{/* Reviewer selector */}
											<Select
												id="member"
												label={t("web.mrReviewerLabel")}
												placeholder={t("web.mrSkipReviewer")}
												items={reviewerItems(
													s.members,
													t("web.mrSkipReviewer"),
												)}
												value={
													s.reviewerId
														? {
																name: s.reviewerName,
																id: s.reviewerId,
																username: "",
															}
														: {
																name: t("web.mrSkipReviewer"),
																id: 0,
																username: "",
															}
												}
												isEqual={(a, b) => a.id === b.id}
												dropdown={memberDd}
												onSelect={(item) =>
													d({
														type: "SELECT_REVIEWER",
														id: item.id,
														name: item.id === 0 ? "" : item.name,
													})
												}
												onOpen={() => {
													if (!s.members.length && s.projectId) loadMembers();
												}}
												renderItem={memberRenderItem}
												renderValue={(item) =>
													item.id === 0 ? t("web.mrSkipReviewer") : item.name
												}
												searchPlaceholder={t("web.mrFilterReviewer")}
												emptyText={
													s.membersLoading ? undefined : t("web.mrNoReviewer")
												}
											/>

											{draftToggle()}
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
												<LoadingRow text={t("web.mrPushing")} />
											)}
											{s.pushStatus === "success" && (
												<ResultCard variant="success">
													<div class="result-label">{t("web.mrPushBtn")}</div>
													<ResultText variant="success">
														{t("web.mrPushSuccess")}
													</ResultText>
												</ResultCard>
											)}
											{s.pushStatus === "error" && (
												<ResultCard variant="error">
													<ResultText variant="error">
														{t("web.mrPushFailed")}
													</ResultText>
												</ResultCard>
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
										<LoadingRow text={t("web.mrCreatingMR")} />
									)}
									{(s.mrStatus === "success" || s.mrStatus === "existing") &&
										mrSuccessCard()}
									{s.mrStatus === "error" && (
										<ResultCard variant="error">
											<ResultText variant="error">{s.mrError}</ResultText>
										</ResultCard>
									)}

									{/* ── Step 5: Jira ── */}
									{s.mrUrl && s.ticketKeys.length > 0 && jiraSection()}
									{s.mrUrl && s.ticketKeys.length === 0 && (
										<ResultCard>
											<ResultText>{t("web.mrNoTickets")}</ResultText>
										</ResultCard>
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

					{s.error && (
						<ResultCard variant="error">
							<ResultText variant="error">{s.error}</ResultText>
						</ResultCard>
					)}

					{/* ── History exists: show history + new button (modal for creation) ── */}
					{s.history.length > 0 && !s.modalOpen && historySection()}

					{s.quickExecuting && <LoadingRow text={t("web.mrCreatingMR")} />}

					{(s.mrStatus === "success" || s.mrStatus === "existing") &&
						!s.modalOpen &&
						mrSuccessCard()}

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
							<Select
								id="project"
								label={t("web.projectLabel")}
								placeholder={t("web.mrSelectProject")}
								items={projectItems(s.projects)}
								value={
									s.projectId
										? {
												name: s.projectName,
												id: s.projectId,
												pathWithNamespace: s.projectPath,
											}
										: null
								}
								isEqual={(a, b) => Number(a.id) === Number(b.id)}
								dropdown={projectDd}
								onSelect={(item) => {
									d({
										type: "SELECT_REMOTE_PROJECT",
										projectId: item.id,
										projectName: item.name,
										projectPath: item.pathWithNamespace ?? "",
									});
									loadRemoteBranches(item.id);
									loadMembers(item.id);
								}}
								renderItem={projectRenderItem}
								searchPlaceholder={t("web.mrSearchProject")}
								emptyText={
									s.projectsLoading ? undefined : t("web.mrNoProjects")
								}
							/>

							{/* ── Step 1: Branches ── */}
							{s.projectId > 0 && (
								<div>
									{/* Source branch selector */}
									<Select
										id="source-branch"
										label={t("web.mrFromBranch")}
										placeholder={t("web.mrSelectFrom")}
										items={branchItems(s.remoteBranches)}
										value={s.sourceBranch ? { name: s.sourceBranch } : null}
										isEqual={(a, b) => a.name === b.name}
										dropdown={sourceBranchDd}
										onSelect={(item) =>
											d({ type: "SELECT_SOURCE_BRANCH", branch: item.name })
										}
										onOpen={() => {
											if (!s.remoteBranches.length) loadRemoteBranches();
										}}
										renderItem={branchRenderItem}
										searchPlaceholder={t("web.mrFilterFrom")}
										emptyText={
											s.remoteBranchesLoading ? undefined : t("web.mrNoTarget")
										}
										zIndex={200}
									/>

									{/* Target branch selector */}
									<Select
										id="branch"
										label={t("web.mrIntoBranch")}
										placeholder={t("web.mrSelectInto")}
										items={branchItems(s.remoteBranches)}
										value={s.targetBranch ? { name: s.targetBranch } : null}
										isEqual={(a, b) => a.name === b.name}
										dropdown={branchDd}
										onSelect={(item) =>
											d({ type: "SELECT_TARGET_BRANCH", branch: item.name })
										}
										onOpen={() => {
											if (!s.remoteBranches.length) loadRemoteBranches();
										}}
										renderItem={branchRenderItem}
										searchPlaceholder={t("web.mrFilterInto")}
										emptyText={
											s.remoteBranchesLoading ? undefined : t("web.mrNoTarget")
										}
									/>
								</div>
							)}

							{/* ── Step 2: Title & Description ── */}
							{s.sourceBranch && s.targetBranch && (
								<div>
									{titleDescInputs()}

									{/* Reviewer selector */}
									<Select
										id="member"
										label={t("web.mrReviewerLabel")}
										placeholder={t("web.mrSkipReviewer")}
										items={reviewerItems(s.members, t("web.mrSkipReviewer"))}
										value={
											s.reviewerId
												? {
														name: s.reviewerName,
														id: s.reviewerId,
														username: "",
													}
												: { name: t("web.mrSkipReviewer"), id: 0, username: "" }
										}
										isEqual={(a, b) => a.id === b.id}
										dropdown={memberDd}
										onSelect={(item) =>
											d({
												type: "SELECT_REVIEWER",
												id: item.id,
												name: item.id === 0 ? "" : item.name,
											})
										}
										onOpen={() => {
											if (!s.members.length && s.projectId) loadMembers();
										}}
										renderItem={memberRenderItem}
										renderValue={(item) =>
											item.id === 0 ? t("web.mrSkipReviewer") : item.name
										}
										searchPlaceholder={t("web.mrFilterReviewer")}
										emptyText={
											s.membersLoading ? undefined : t("web.mrNoReviewer")
										}
									/>

									{draftToggle()}
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
								<LoadingRow text={t("web.mrCreatingMR")} />
							)}
							{(s.mrStatus === "success" || s.mrStatus === "existing") &&
								mrSuccessCard()}
							{s.mrStatus === "error" && (
								<ResultCard variant="error">
									<ResultText variant="error">{s.mrError}</ResultText>
								</ResultCard>
							)}

							{/* ── Step 4: Jira ── */}
							{s.mrUrl && s.ticketKeys.length > 0 && jiraSection()}
						</>
					)}
				</>
			)}

			{/* ── Modal: New MR creation ── */}
			<Modal
				open={s.modalOpen}
				onClose={() => d({ type: "TOGGLE_MODAL", open: false })}
				title={t("web.mrNewModalTitle")}
				variant="wide"
			>
				{/* ── Modal create flow for local mode ── */}
				{s.mode === "local" && s.currentBranch && (
					<>
						<Pipeline steps={pipelineSteps} />

						<ResultCard>
							<div class="result-label">{t("web.mrFromBranch")}</div>
							<ResultText variant="success">{s.currentBranch}</ResultText>
							{s.detectedSource && (
								<span class="result-badge">
									{t("web.mrDetectSource")}: {s.detectedSource}
								</span>
							)}
						</ResultCard>

						{/* Target branch selector */}
						<Select
							id="branch"
							label={t("web.mrIntoBranch")}
							placeholder={t("web.mrSelectInto")}
							items={branchItems(s.remoteBranches)}
							value={s.targetBranch ? { name: s.targetBranch } : null}
							isEqual={(a, b) => a.name === b.name}
							dropdown={branchDd}
							onSelect={(item) =>
								d({ type: "SELECT_TARGET_BRANCH", branch: item.name })
							}
							onOpen={() => {
								if (!s.remoteBranches.length && s.projectId)
									loadRemoteBranches();
							}}
							renderItem={branchRenderItem}
							searchPlaceholder={t("web.mrFilterInto")}
							emptyText={
								s.remoteBranchesLoading ? undefined : t("web.mrNoTarget")
							}
						/>

						{s.targetBranch && (
							<div>
								{titleDescInputs()}

								{/* Reviewer selector */}
								<Select
									id="member"
									label={t("web.mrReviewerLabel")}
									placeholder={t("web.mrSkipReviewer")}
									items={reviewerItems(s.members, t("web.mrSkipReviewer"))}
									value={
										s.reviewerId
											? { name: s.reviewerName, id: s.reviewerId, username: "" }
											: { name: t("web.mrSkipReviewer"), id: 0, username: "" }
									}
									isEqual={(a, b) => a.id === b.id}
									dropdown={memberDd}
									onSelect={(item) =>
										d({
											type: "SELECT_REVIEWER",
											id: item.id,
											name: item.id === 0 ? "" : item.name,
										})
									}
									onOpen={() => {
										if (!s.members.length && s.projectId) loadMembers();
									}}
									renderItem={memberRenderItem}
									renderValue={(item) =>
										item.id === 0 ? t("web.mrSkipReviewer") : item.name
									}
									searchPlaceholder={t("web.mrFilterReviewer")}
									emptyText={
										s.membersLoading ? undefined : t("web.mrNoReviewer")
									}
								/>

								{draftToggle()}
							</div>
						)}

						{/* Push */}
						{s.targetBranch && (
							<div>
								{s.pushStatus === "idle" && (
									<button class="action-btn" type="button" onClick={pushBranch}>
										{t("web.mrPushBtn")}
									</button>
								)}
								{s.pushStatus === "running" && (
									<LoadingRow text={t("web.mrPushing")} />
								)}
								{s.pushStatus === "success" && (
									<ResultCard variant="success">
										<div class="result-label">{t("web.mrPushBtn")}</div>
										<ResultText variant="success">
											{t("web.mrPushSuccess")}
										</ResultText>
									</ResultCard>
								)}
								{s.pushStatus === "error" && (
									<ResultCard variant="error">
										<ResultText variant="error">
											{t("web.mrPushFailed")}
										</ResultText>
									</ResultCard>
								)}
								{s.pushStatus !== "success" && s.pushStatus !== "running" && (
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
									{s.draft ? t("web.mrCreateDraftBtn") : t("web.mrCreateBtn")}
								</button>
							</div>
						)}
						{s.mrStatus === "running" && (
							<LoadingRow text={t("web.mrCreatingMR")} />
						)}
						{(s.mrStatus === "success" || s.mrStatus === "existing") &&
							mrSuccessCard()}
						{s.mrStatus === "error" && (
							<ResultCard variant="error">
								<ResultText variant="error">{s.mrError}</ResultText>
							</ResultCard>
						)}
					</>
				)}

				{/* ── Modal create flow for remote mode ── */}
				{s.mode === "remote" && (
					<>
						<Pipeline steps={pipelineSteps} />

						{/* Project selector */}
						<Select
							id="project"
							label={t("web.projectLabel")}
							placeholder={t("web.mrSelectProject")}
							items={projectItems(s.projects)}
							value={
								s.projectId
									? {
											name: s.projectName,
											id: s.projectId,
											pathWithNamespace: s.projectPath,
										}
									: null
							}
							isEqual={(a, b) => Number(a.id) === Number(b.id)}
							dropdown={projectDd}
							onSelect={(item) => {
								d({
									type: "SELECT_REMOTE_PROJECT",
									projectId: item.id,
									projectName: item.name,
									projectPath: item.pathWithNamespace ?? "",
								});
								loadRemoteBranches(item.id);
								loadMembers(item.id);
							}}
							renderItem={projectRenderItem}
							searchPlaceholder={t("web.mrSearchProject")}
							emptyText={s.projectsLoading ? undefined : t("web.mrNoProjects")}
						/>

						{/* Branches */}
						{s.projectId > 0 && (
							<div>
								{/* Source branch */}
								<Select
									id="source-branch"
									label={t("web.mrFromBranch")}
									placeholder={t("web.mrSelectFrom")}
									items={branchItems(s.remoteBranches)}
									value={s.sourceBranch ? { name: s.sourceBranch } : null}
									isEqual={(a, b) => a.name === b.name}
									dropdown={sourceBranchDd}
									onSelect={(item) =>
										d({ type: "SELECT_SOURCE_BRANCH", branch: item.name })
									}
									onOpen={() => {
										if (!s.remoteBranches.length) loadRemoteBranches();
									}}
									renderItem={branchRenderItem}
									searchPlaceholder={t("web.mrFilterFrom")}
									emptyText={
										s.remoteBranchesLoading ? undefined : t("web.mrNoTarget")
									}
									zIndex={200}
								/>

								{/* Target branch */}
								<Select
									id="branch"
									label={t("web.mrIntoBranch")}
									placeholder={t("web.mrSelectInto")}
									items={branchItems(s.remoteBranches)}
									value={s.targetBranch ? { name: s.targetBranch } : null}
									isEqual={(a, b) => a.name === b.name}
									dropdown={branchDd}
									onSelect={(item) =>
										d({ type: "SELECT_TARGET_BRANCH", branch: item.name })
									}
									onOpen={() => {
										if (!s.remoteBranches.length) loadRemoteBranches();
									}}
									renderItem={branchRenderItem}
									searchPlaceholder={t("web.mrFilterInto")}
									emptyText={
										s.remoteBranchesLoading ? undefined : t("web.mrNoTarget")
									}
								/>
							</div>
						)}

						{/* Title & Description */}
						{s.sourceBranch && s.targetBranch && (
							<div>
								{titleDescInputs()}

								{/* Reviewer */}
								<Select
									id="member"
									label={t("web.mrReviewerLabel")}
									placeholder={t("web.mrSkipReviewer")}
									items={reviewerItems(s.members, t("web.mrSkipReviewer"))}
									value={
										s.reviewerId
											? { name: s.reviewerName, id: s.reviewerId, username: "" }
											: { name: t("web.mrSkipReviewer"), id: 0, username: "" }
									}
									isEqual={(a, b) => a.id === b.id}
									dropdown={memberDd}
									onSelect={(item) =>
										d({
											type: "SELECT_REVIEWER",
											id: item.id,
											name: item.id === 0 ? "" : item.name,
										})
									}
									onOpen={() => {
										if (!s.members.length && s.projectId) loadMembers();
									}}
									renderItem={memberRenderItem}
									renderValue={(item) =>
										item.id === 0 ? t("web.mrSkipReviewer") : item.name
									}
									searchPlaceholder={t("web.mrFilterReviewer")}
									emptyText={
										s.membersLoading ? undefined : t("web.mrNoReviewer")
									}
								/>

								{draftToggle()}
							</div>
						)}

						{/* Create MR */}
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
							<LoadingRow text={t("web.mrCreatingMR")} />
						)}
						{(s.mrStatus === "success" || s.mrStatus === "existing") &&
							mrSuccessCard()}
						{s.mrStatus === "error" && (
							<ResultCard variant="error">
								<ResultText variant="error">{s.mrError}</ResultText>
							</ResultCard>
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
			</Modal>
		</>
	);
};

export const mount = async (el: HTMLElement) => {
	await initPromise;
	render(<MrClient />, el);
};
