import { type FC, useEffect, useReducer, useRef } from "hono/jsx";
import { render } from "hono/jsx/dom";
import i18next from "i18next";
import {
	commonCss,
	fieldLabel,
	PageHeader,
	pageHeaderCss,
	sectionTitle,
} from "../../shared/components/common";
import { modalCss } from "../../shared/components/modal";
import { Badge } from "../../shared/components/neonblade/badge";
import { BorderBeamCornerCutCard } from "../../shared/components/neonblade/border-beam-corner-cut-card";
import { CornerCutButton } from "../../shared/components/neonblade/corner-cut-button";
import { GlitchText } from "../../shared/components/neonblade/glitch-text";
import { NeonGlow } from "../../shared/components/neonblade/neon-glow";
import { NeonGlowCornerCutCard } from "../../shared/components/neonblade/neon-glow-corner-cut-card";
import { NeonSelect } from "../../shared/components/neonblade/neon-select";
import { ProgressBar } from "../../shared/components/neonblade/progress-bar";
import { useChainPolling } from "../../utils/polling";

const ACCENT = "#bf00ff";
const ERROR_COLOR = "#ff4444";

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
	jenkinsJobName: string | null;
};
type JenkinsJob = {
	name: string;
	url: string;
	color: string;
	fullName?: string;
};
type JenkinsArtifact = { fileName: string; relativePath: string };
type JenkinsBuildInfo = {
	number: number;
	url: string;
	result: string | null;
	building: boolean;
	duration: number;
	timestamp: number;
	displayName?: string;
	artifacts?: JenkinsArtifact[];
};
type WatchHistoryEntry = {
	id: string;
	createdAt: string;
	projectId: number;
	projectName: string;
	projectPath: string;
	branch: string;
	jenkinsJobName: string;
};

type BuildStatus =
	| "idle"
	| "polling"
	| "building"
	| "success"
	| "failure"
	| "aborted"
	| "error"
	| "no-build";

const watchStyle = `${commonCss}${pageHeaderCss}${modalCss}
  /* ── Theme: purple accent overrides ── */
  .spinner { border-top-color: ${ACCENT}; }

  /* ── Step indicator (Badge-based) ── */
  .watch-steps {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
  }
  .watch-step-sep {
    display: inline-flex;
    align-items: center;
    color: ${ACCENT};
    opacity: 0.6;
    font-size: 14px;
  }

  /* ── Tabs (inside NeonGlowCornerCutCard) ── */
  .watch-tabs-card { display: inline-flex; width: fit-content; margin-bottom: 24px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both; }
  .watch-tabs-card .ngcc-card { padding: 8px; display: flex; flex-direction: row; align-items: center; gap: 6px; }
  .watch-tab-cta { flex: 0 0 auto; }

  /* ── Quick search ── */
  .quick-section {
    position: relative;
    z-index: 10;
    margin-bottom: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }

  .empty-hint { text-align: center; padding: 32px 0; font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
  .error-text { color: ${ERROR_COLOR}; font-size: 13px; margin-top: 12px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* ── History item layout ── */
  .history-item { position: relative; }
  .history-item .bbc-inner { padding: 12px 16px; }
  .history-info {
    min-width: 0;
    flex: 1;
  }
  .history-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .retry-icon {
    display: inline-block;
    width: 14px;
    height: 14px;
    stroke: currentColor;
    vertical-align: middle;
  }
  /* ── Build result (rendered inside NeonGlowCornerCutCard) ── */
  .build-section-card { margin-top: 16px; }
  .build-section-card .ngcc-card { padding: 0; }
  .build-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }
  .build-top-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .build-top-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stop-polling-btn { animation: stop-polling-pulse 1.3s ease-in-out infinite !important; }
  @keyframes stop-polling-pulse {
    0%, 100% { box-shadow: 0 0 6px color-mix(in srgb, #ff4444 35%, transparent); }
    50% { box-shadow: 0 0 16px color-mix(in srgb, #ff4444 75%, transparent); }
  }

  .build-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
  }
  .build-meta-cell {
    padding: 14px 16px;
    border-right: 1px solid var(--border);
  }
  .build-meta-cell:last-child { border-right: none; }
  .build-meta-label {
    font-size: 10px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--sans);
    margin-bottom: 4px;
  }
  .build-meta-value {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
  }
  .build-meta-value a {
    color: ${ACCENT};
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .build-meta-value a:hover { opacity: 0.8; }

  .build-polling-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(191,0,255,0.04);
    font-size: 12px;
    color: var(--text-3);
    border-top: 1px solid rgba(191,0,255,0.08);
  }

  .artifacts-list {
    padding: 14px 16px;
    border-top: 1px solid var(--border);
  }
  .artifacts-title {
    font-size: 10px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
    font-family: var(--sans);
    font-weight: 600;
  }
  .artifacts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 6px;
  }
  .artifact-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--bg-void);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: var(--mono);
    font-size: 12px;
    overflow: hidden;
  }
  .artifact-icon { flex-shrink: 0; font-size: 12px; }
  .artifact-link {
    color: ${ACCENT};
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s;
  }
  .artifact-link:hover { color: #d566ff; }

  .history-section { margin-bottom: 24px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both; }
  .history-list { display: flex; flex-direction: column; gap: 8px; }
  .history-item-row { display: flex; align-items: center; justify-content: space-between; }
  .history-info { display: flex; align-items: center; gap: 12px; flex: 1; }
  .history-project { font-weight: 600; font-size: 14px; }
  .history-detail { font-size: 12px; color: var(--text-3); font-family: var(--mono); }
  .history-actions { display: flex; align-items: center; gap: 8px; }
  .history-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .job-name-display-card { margin-bottom: 16px; }
  .job-name-display-card .ngcc-card { padding: 10px 14px; }
  .pom-fallback-card { margin-top: 12px; height: auto !important; }
  .pom-fallback-card .ngcc-card { padding: 12px 14px; height: auto !important; }
  .pom-fallback-card .nsl-wrapper { margin-bottom: 0; }
`;

type State = {
	projects: Project[];
	projectsLoading: boolean;
	projectsError: string;
	selected: Project | null;
	branches: Branch[];
	branchesLoading: boolean;
	selectedBranch: string;
	pomInfo: PomInfo | null;
	pomLoading: boolean;
	pomError: string;
	jenkinsJobs: JenkinsJob[];
	jenkinsJobsLoading: boolean;
	jenkinsJobName: string;
	selectedJob: JenkinsJob | null;
	buildStatus: BuildStatus;
	buildInfo: JenkinsBuildInfo | null;
	buildError: string;
	polling: boolean;
	projectFlowStartedAt: number;
	history: WatchHistoryEntry[];
	historyLoading: boolean;
	historyBuilds: Record<
		string,
		{
			buildStatus: BuildStatus;
			buildInfo: JenkinsBuildInfo | null;
			buildError: string;
			polling: boolean;
			startedAt?: number;
		}
	>;
	activeTab: "quick" | "project";
	quickJobs: JenkinsJob[];
	quickJobsLoading: boolean;
	quickSelectedJob: JenkinsJob | null;
	quickBuildStatus: BuildStatus;
	quickBuildInfo: JenkinsBuildInfo | null;
	quickBuildError: string;
	quickPolling: boolean;
	quickPollingStartedAt: number;
	clearConfirm: boolean;
};

const initial: State = {
	projects: [],
	projectsLoading: true,
	projectsError: "",
	selected: null,
	branches: [],
	branchesLoading: false,
	selectedBranch: "",
	pomInfo: null,
	pomLoading: false,
	pomError: "",
	jenkinsJobs: [],
	jenkinsJobsLoading: false,
	jenkinsJobName: "",
	selectedJob: null,
	buildStatus: "idle",
	buildInfo: null,
	buildError: "",
	polling: false,
	projectFlowStartedAt: 0,
	history: [],
	historyLoading: true,
	historyBuilds: {},
	activeTab: "quick",
	quickJobs: [],
	quickJobsLoading: false,
	quickSelectedJob: null,
	quickBuildStatus: "idle",
	quickBuildInfo: null,
	quickBuildError: "",
	quickPolling: false,
	quickPollingStartedAt: 0,
	clearConfirm: false,
};

type Action =
	| { type: "PROJECTS_LOADED"; projects: Project[] }
	| { type: "PROJECTS_ERROR"; error: string }
	| { type: "SELECT_PROJECT"; project: Project }
	| { type: "CLEAR_PROJECT" }
	| { type: "BRANCHES_LOADING" }
	| { type: "BRANCHES_LOADED"; branches: Branch[] }
	| { type: "SELECT_BRANCH"; branch: string }
	| { type: "POM_LOADING" }
	| { type: "POM_LOADED"; info: PomInfo }
	| { type: "POM_ERROR"; error: string }
	| { type: "JENKINS_JOBS_LOADING" }
	| { type: "JENKINS_JOBS_LOADED"; jobs: JenkinsJob[] }
	| { type: "SELECT_JENKINS_JOB"; job: JenkinsJob }
	| { type: "MANUAL_JOB_SELECTED"; job: JenkinsJob }
	| { type: "CLEAR_JENKINS_JOB" }
	| { type: "BUILD_START_POLL" }
	| { type: "BUILD_POLL_RESULT"; info: JenkinsBuildInfo }
	| { type: "BUILD_ERROR"; error: string }
	| { type: "BUILD_STOP_POLL" }
	| { type: "BUILD_RESET" }
	| { type: "SET_HISTORY"; history: WatchHistoryEntry[] }
	| { type: "CLEAR_CONFIRM_TOGGLE" }
	| { type: "CLEAR_HISTORY_DONE" }
	| {
			type: "HISTORY_BUILD_START";
			id: string;
	  }
	| {
			type: "HISTORY_BUILD_RESULT";
			id: string;
			info: JenkinsBuildInfo;
	  }
	| {
			type: "HISTORY_BUILD_ERROR";
			id: string;
			error: string;
	  }
	| {
			type: "HISTORY_BUILD_STOP";
			id: string;
	  }
	| {
			type: "HISTORY_BUILD_RESET";
			id: string;
	  }
	| { type: "REMOVE_HISTORY_ENTRY"; id: string }
	| { type: "HISTORY_BUILD_CLEAR"; id: string }
	| { type: "CLEAN_HISTORY_BUILDS" }
	| { type: "SET_ACTIVE_TAB"; tab: "quick" | "project" }
	| { type: "QUICK_SELECT_JOB"; job: JenkinsJob }
	| { type: "QUICK_JOBS_LOADING" }
	| { type: "QUICK_JOBS_LOADED"; jobs: JenkinsJob[] }
	| { type: "QUICK_BUILD_START" }
	| { type: "QUICK_BUILD_RESULT"; info: JenkinsBuildInfo }
	| { type: "QUICK_BUILD_ERROR"; error: string }
	| { type: "QUICK_BUILD_STOP" }
	| { type: "QUICK_BUILD_RESET" };

const reducer = (state: State, action: Action): State => {
	switch (action.type) {
		case "PROJECTS_LOADED":
			return { ...state, projects: action.projects, projectsLoading: false };
		case "PROJECTS_ERROR":
			return { ...state, projectsError: action.error, projectsLoading: false };
		case "SELECT_PROJECT":
			return {
				...state,
				selected: action.project,
				branches: [],
				branchesLoading: false,
				selectedBranch: "",
				pomInfo: null,
				pomError: "",
				jenkinsJobs: [],
				jenkinsJobName: "",
				selectedJob: null,
				buildStatus: "idle",
				buildInfo: null,
				buildError: "",
				polling: false,
			};
		case "CLEAR_PROJECT":
			return {
				...state,
				selected: null,
				branches: [],
				selectedBranch: "",
				pomInfo: null,
				pomError: "",
				pomLoading: false,
				jenkinsJobs: [],
				jenkinsJobName: "",
				selectedJob: null,
				buildStatus: "idle",
				buildInfo: null,
				buildError: "",
				polling: false,
			};
		case "BRANCHES_LOADING":
			return {
				...state,
				branchesLoading: true,
				branches: [],
				selectedBranch: "",
				pomLoading: false,
				pomInfo: null,
				pomError: "",
				jenkinsJobs: [],
				selectedJob: null,
				jenkinsJobName: "",
				buildStatus: "idle",
				buildInfo: null,
				buildError: "",
				polling: false,
			};
		case "BRANCHES_LOADED":
			return { ...state, branches: action.branches, branchesLoading: false };
		case "SELECT_BRANCH":
			return {
				...state,
				selectedBranch: action.branch,
				pomInfo: null,
				pomError: "",
				jenkinsJobs: [],
				jenkinsJobName: "",
				selectedJob: null,
				buildStatus: "idle",
				buildInfo: null,
				buildError: "",
				polling: false,
			};
		case "POM_LOADING":
			return { ...state, pomLoading: true, pomError: "", pomInfo: null };
		case "POM_LOADED": {
			return {
				...state,
				pomLoading: false,
				pomInfo: action.info,
				jenkinsJobName: action.info.jenkinsJobName ?? "",
			};
		}
		case "POM_ERROR":
			return { ...state, pomLoading: false, pomError: action.error };
		case "JENKINS_JOBS_LOADING":
			return {
				...state,
				jenkinsJobsLoading: true,
				jenkinsJobs: [],
				selectedJob: null,
			};
		case "JENKINS_JOBS_LOADED":
			return { ...state, jenkinsJobsLoading: false, jenkinsJobs: action.jobs };
		case "SELECT_JENKINS_JOB":
			return {
				...state,
				selectedJob: action.job,
				buildStatus: "idle",
				buildInfo: null,
				buildError: "",
			};
		case "MANUAL_JOB_SELECTED":
			return {
				...state,
				selectedJob: action.job,
				jenkinsJobName: action.job.name,
				pomError: "",
				pomInfo: null,
				buildStatus: "idle",
				buildInfo: null,
				buildError: "",
			};
		case "CLEAR_JENKINS_JOB":
			return {
				...state,
				selectedJob: null,
				buildStatus: "idle",
				buildInfo: null,
				buildError: "",
				polling: false,
			};
		case "BUILD_START_POLL":
			return {
				...state,
				buildStatus: "polling",
				buildError: "",
				polling: true,
				projectFlowStartedAt: Date.now(),
			};
		case "BUILD_POLL_RESULT": {
			const info = action.info;
			if (info.building) {
				return {
					...state,
					buildStatus: "building",
					buildInfo: info,
					polling: true,
				};
			}
			const status: BuildStatus =
				info.result === "SUCCESS"
					? "success"
					: info.result === "FAILURE"
						? "failure"
						: info.result === "ABORTED"
							? "aborted"
							: "error";
			return { ...state, buildStatus: status, buildInfo: info, polling: false };
		}
		case "BUILD_ERROR":
			return {
				...state,
				buildStatus: "error",
				buildError: action.error,
			};
		case "BUILD_STOP_POLL":
			return { ...state, polling: false };
		case "BUILD_RESET":
			return {
				...state,
				buildStatus: "idle",
				buildInfo: null,
				buildError: "",
				polling: false,
				projectFlowStartedAt: 0,
			};
		case "SET_HISTORY":
			return { ...state, history: action.history, historyLoading: false };
		case "CLEAR_CONFIRM_TOGGLE":
			return { ...state, clearConfirm: !state.clearConfirm };
		case "CLEAR_HISTORY_DONE":
			return { ...state, history: [], clearConfirm: false, historyBuilds: {} };
		case "HISTORY_BUILD_START": {
			const id = action.id;
			return {
				...state,
				historyBuilds: {
					...state.historyBuilds,
					[id]: {
						buildStatus: "polling",
						buildInfo: null,
						buildError: "",
						polling: true,
						startedAt: Date.now(),
					},
				},
			};
		}
		case "HISTORY_BUILD_RESULT": {
			const id = action.id;
			const info = action.info;
			if (info.building) {
				return {
					...state,
					historyBuilds: {
						...state.historyBuilds,
						[id]: {
							buildStatus: "building",
							buildInfo: info,
							buildError: "",
							polling: true,
						},
					},
				};
			}
			const status: BuildStatus =
				info.result === "SUCCESS"
					? "success"
					: info.result === "FAILURE"
						? "failure"
						: info.result === "ABORTED"
							? "aborted"
							: "error";
			return {
				...state,
				historyBuilds: {
					...state.historyBuilds,
					[id]: {
						...(state.historyBuilds[id] ?? {
							buildStatus: "idle",
							buildInfo: null,
							buildError: "",
							polling: false,
						}),
						buildStatus: status,
						buildInfo: info,
						buildError: "",
						polling: false,
					},
				},
			};
		}
		case "HISTORY_BUILD_ERROR": {
			const id = action.id;
			return {
				...state,
				historyBuilds: {
					...state.historyBuilds,
					[id]: {
						...(state.historyBuilds[id] ?? {
							buildStatus: "idle",
							buildInfo: null,
							buildError: "",
							polling: true,
						}),
						buildStatus: "error",
						buildError: action.error,
					},
				},
			};
		}
		case "HISTORY_BUILD_STOP": {
			const id = action.id;
			const prev = state.historyBuilds[id];
			return {
				...state,
				historyBuilds: {
					...state.historyBuilds,
					[id]: prev
						? { ...prev, polling: false }
						: {
								buildStatus: "idle",
								buildInfo: null,
								buildError: "",
								polling: false,
							},
				},
			};
		}
		case "HISTORY_BUILD_RESET": {
			const id = action.id;
			return {
				...state,
				historyBuilds: {
					...state.historyBuilds,
					[id]: {
						buildStatus: "idle",
						buildInfo: null,
						buildError: "",
						polling: false,
						startedAt: 0,
					},
				},
			};
		}
		case "REMOVE_HISTORY_ENTRY": {
			const id = action.id;
			const { [id]: _, ...restBuilds } = state.historyBuilds;
			return {
				...state,
				history: state.history.filter((h) => h.id !== id),
				historyBuilds: restBuilds,
			};
		}
		case "HISTORY_BUILD_CLEAR": {
			const id = action.id;
			const { [id]: _, ...rest } = state.historyBuilds;
			return { ...state, historyBuilds: rest };
		}
		case "CLEAN_HISTORY_BUILDS": {
			const remaining = new Set(state.history.map((h) => h.id));
			const next: State["historyBuilds"] = {};
			for (const [id, build] of Object.entries(state.historyBuilds)) {
				if (remaining.has(id)) next[id] = build;
			}
			return { ...state, historyBuilds: next };
		}
		case "SET_ACTIVE_TAB":
			return { ...state, activeTab: action.tab };
		case "QUICK_SELECT_JOB":
			return {
				...state,
				quickSelectedJob: action.job,
				quickBuildStatus: "idle",
				quickBuildInfo: null,
				quickBuildError: "",
				quickPolling: false,
			};
		case "QUICK_JOBS_LOADING":
			return {
				...state,
				quickJobsLoading: true,
				quickJobs: [],
				quickSelectedJob: null,
			};
		case "QUICK_JOBS_LOADED":
			return { ...state, quickJobsLoading: false, quickJobs: action.jobs };
		case "QUICK_BUILD_START":
			return {
				...state,
				quickBuildStatus: "polling",
				quickBuildError: "",
				quickPolling: true,
				quickPollingStartedAt: Date.now(),
			};
		case "QUICK_BUILD_RESULT": {
			const info = action.info;
			if (info.building) {
				return {
					...state,
					quickBuildStatus: "building",
					quickBuildInfo: info,
					quickPolling: true,
				};
			}
			const status: BuildStatus =
				info.result === "SUCCESS"
					? "success"
					: info.result === "FAILURE"
						? "failure"
						: info.result === "ABORTED"
							? "aborted"
							: "error";
			return {
				...state,
				quickBuildStatus: status,
				quickBuildInfo: info,
				quickPolling: false,
			};
		}
		case "QUICK_BUILD_ERROR":
			return {
				...state,
				quickBuildStatus: "error",
				quickBuildError: action.error,
			};
		case "QUICK_BUILD_STOP":
			return { ...state, quickPolling: false };
		case "QUICK_BUILD_RESET":
			return {
				...state,
				quickBuildStatus: "idle",
				quickBuildInfo: null,
				quickBuildError: "",
				quickPolling: false,
				quickPollingStartedAt: 0,
				quickSelectedJob: null,
			};
	}
};

const formatDuration = (ms: number): string => {
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	const rem = s % 60;
	if (m > 0) return t("web.watchDurationMinutes", { minutes: m, seconds: rem });
	return t("web.watchDurationSeconds", { seconds: rem });
};

const formatBuildTime = (timestamp: number): string => {
	if (!timestamp) return "";
	const d = new Date(timestamp);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const HistoryBuildItem: FC<{
	entry: WatchHistoryEntry;
	s: State;
	d: (a: Action) => void;
}> = ({ entry, s, d }) => {
	const id = entry.id;
	const build = s.historyBuilds[id] ?? {
		buildStatus: "idle",
		buildInfo: null,
		buildError: "",
		polling: false,
		startedAt: undefined,
	};

	useChainPolling({
		active: build.polling,
		jobName: entry.jenkinsJobName,
		onResult: (info) =>
			d({ type: "HISTORY_BUILD_RESULT", id, info: info as JenkinsBuildInfo }),
		onError: (error) => d({ type: "HISTORY_BUILD_ERROR", id, error }),
		restartToken: build.startedAt,
	});

	const handleWatch = () => {
		d({ type: "HISTORY_BUILD_START", id });
	};

	const handleStop = () => {
		d({ type: "HISTORY_BUILD_RESET", id });
	};

	const handleDelete = async () => {
		const res = await fetch(`/watch/api/history/${encodeURIComponent(id)}`, {
			method: "DELETE",
		});
		if (res.ok) d({ type: "REMOVE_HISTORY_ENTRY", id });
	};

	const handleRetry = async () => {
		try {
			await fetch(
				`/watch/api/jenkins/trigger?job=${encodeURIComponent(entry.jenkinsJobName)}`,
				{ method: "POST" },
			);
			// Wait a bit for Jenkins to start the build
			await new Promise((resolve) => setTimeout(resolve, 1000));
			handleWatch();
		} catch (e) {
			d({
				type: "HISTORY_BUILD_ERROR",
				id,
				error: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const bi = build.buildInfo;
	const status = build.buildStatus;

	const renderBuild = () => {
		if (status === "idle") return null;
		if (status === "polling") {
			return (
				<NeonGlowCornerCutCard
					className="build-section-card"
					colorA={ACCENT}
					size="sm"
					hoverEffect="glow-only"
					style="margin-top:12px"
				>
					<div class="build-top">
						<div class="build-top-left">
							<Badge
								color={ACCENT}
								variant="ghost"
								shape="pill"
								size="sm"
								glow
								dot="pulse"
							>
								{t("web.watchFetchingBuild")}
							</Badge>
						</div>
					</div>
				</NeonGlowCornerCutCard>
			);
		}
		if (status === "error") {
			return (
				<NeonGlowCornerCutCard
					className="build-section-card"
					colorA={ERROR_COLOR}
					size="sm"
					hoverEffect="glow-only"
					style="margin-top:12px"
				>
					<div class="build-top">
						<div class="build-top-left">
							<Badge
								color="#ff4444"
								variant="ghost"
								shape="pill"
								size="sm"
								glow
								dot="solid"
							>
								{t("web.watchBuildError")}
							</Badge>
						</div>
						<CornerCutButton
							color="#ff4444"
							variant="ghost"
							size="xs"
							className="stop-polling-btn"
							onClick={handleStop}
						>
							<svg
								width="8"
								height="8"
								viewBox="0 0 24 24"
								fill="currentColor"
								stroke="none"
							>
								<title>Stop</title>
								<rect x="4" y="4" width="16" height="16" rx="2" />
							</svg>
							{t("web.watchStopPolling")}
						</CornerCutButton>
					</div>
					<div
						class="error-text"
						role="alert"
						style="margin-top:0;padding:10px 14px"
					>
						<NeonGlow colors={ERROR_COLOR} glowIntensity="subtle">
							{build.buildError}
						</NeonGlow>
					</div>
				</NeonGlowCornerCutCard>
			);
		}
		if (!bi) return null;
		const statusClass = bi.building
			? "building"
			: bi.result === "SUCCESS"
				? "success"
				: bi.result === "FAILURE"
					? "failure"
					: "aborted";
		const statusLabel = bi.building
			? t("web.watchBuilding")
			: bi.result === "SUCCESS"
				? t("web.watchBuildSuccess")
				: bi.result === "FAILURE"
					? t("web.watchBuildFailed")
					: (bi.result ?? t("web.watchBuildUnknown"));

		const cardColor =
			statusClass === "failure" || statusClass === "aborted"
				? ERROR_COLOR
				: ACCENT;
		const statusColor =
			statusClass === "failure"
				? "#ff4444"
				: statusClass === "aborted"
					? "#ffaa00"
					: statusClass === "building"
						? ACCENT
						: "#39ff14";

		return (
			<NeonGlowCornerCutCard
				className="build-section-card"
				colorA={cardColor}
				size="sm"
				hoverEffect="glow-only"
				style="margin-top:12px"
			>
				<div class="build-top">
					<div class="build-top-left">
						<Badge
							color={statusColor}
							variant="ghost"
							shape="pill"
							size="sm"
							glow
							dot={statusClass === "building" ? "pulse" : "solid"}
						>
							{statusLabel}
						</Badge>
					</div>
					<CornerCutButton
						color="#ff4444"
						variant="ghost"
						size="xs"
						className="stop-polling-btn"
						onClick={handleStop}
					>
						<svg
							width="8"
							height="8"
							viewBox="0 0 24 24"
							fill="currentColor"
							stroke="none"
							role="img"
							aria-label={t("web.watchStopPolling")}
						>
							<rect x="4" y="4" width="16" height="16" rx="2" />
						</svg>
						{t("web.watchStopPolling")}
					</CornerCutButton>
				</div>
				<div class="build-meta-grid">
					<div class="build-meta-cell">
						<div class="build-meta-label">
							{fieldLabel(ACCENT, t("web.watchBuild"))}
						</div>
						<div class="build-meta-value" style="font-size:12px">
							<a href={bi.url} target="_blank" rel="noreferrer">
								<NeonGlow colors={ACCENT} glowIntensity="subtle">
									#{bi.number}
								</NeonGlow>
							</a>
						</div>
					</div>
					<div class="build-meta-cell">
						<div class="build-meta-label">
							{fieldLabel(ACCENT, t("web.watchDuration"))}
						</div>
						<div class="build-meta-value" style="font-size:12px">
							<NeonGlow colors={ACCENT} glowIntensity="subtle">
								{!bi.building && bi.duration > 0
									? formatDuration(bi.duration)
									: "—"}
							</NeonGlow>
						</div>
					</div>
					<div class="build-meta-cell">
						<div class="build-meta-label">
							{fieldLabel(ACCENT, t("web.watchBuildTime"))}
						</div>
						<div class="build-meta-value" style="font-size:12px">
							<NeonGlow colors={ACCENT} glowIntensity="subtle">
								{bi.timestamp > 0 ? formatBuildTime(bi.timestamp) : "—"}
							</NeonGlow>
						</div>
					</div>
				</div>
				{bi.building && (
					<div
						class="build-polling-bar"
						style="padding:6px 12px;font-size:11px"
					>
						<span
							class="spinner"
							style="width:8px;height:8px;border-width:1px"
						/>
						<NeonGlow colors={ACCENT} glowIntensity="subtle">
							{t("web.watchPollingHint")}
						</NeonGlow>
					</div>
				)}
				{!bi.building && bi.artifacts && bi.artifacts.length > 0 && (
					<div class="artifacts-list" style="padding:10px 12px">
						<div
							class="artifacts-title"
							style="font-size:9px;margin-bottom:6px"
						>
							<NeonGlow colors={ACCENT} glowIntensity="subtle">
								{t("web.watchArtifacts")}
							</NeonGlow>
						</div>
						<div class="artifacts-grid" style="gap:4px">
							{bi.artifacts.map((a) => (
								<div class="artifact-item" style="padding:4px 8px">
									<span class="artifact-icon">
										<svg
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<title>Artifact</title>
											<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
											<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
											<line x1="12" y1="22.08" x2="12" y2="12" />
										</svg>
									</span>
									<a
										class="artifact-link"
										style="font-size:11px"
										href={`${bi.url}artifact/${a.relativePath}`}
										target="_blank"
										rel="noreferrer"
									>
										<NeonGlow colors={ACCENT} glowIntensity="subtle">
											{a.fileName || a.relativePath}
										</NeonGlow>
									</a>
								</div>
							))}
						</div>
					</div>
				)}
			</NeonGlowCornerCutCard>
		);
	};

	return (
		<BorderBeamCornerCutCard
			className="history-item"
			beamColor={ACCENT}
			variant="pulse"
			corner="bottom-right"
			cornerSize={12}
			size="sm"
			glowIntensity="none"
		>
			<div class="history-item-row">
				<div class="history-info">
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						<span class="history-project" style="font-size:15px">
							{entry.jenkinsJobName}
						</span>
					</NeonGlow>
					<span class="history-detail" style="font-size:11px;opacity:0.7">
						<NeonGlow colors={ACCENT} glowIntensity="subtle">
							{entry.projectName} · {entry.branch}
						</NeonGlow>
					</span>
				</div>
				<div class="history-actions">
					{status === "idle" ? (
						<CornerCutButton
							color={ACCENT}
							variant="solid"
							size="xs"
							onClick={handleWatch}
						>
							{t("web.watchNow")}
						</CornerCutButton>
					) : status === "error" ||
						status === "success" ||
						status === "failure" ||
						status === "aborted" ? (
						<>
							{(status === "failure" ||
								status === "aborted" ||
								status === "error") && (
								<CornerCutButton
									color="#ff4444"
									variant="outline"
									size="xs"
									onClick={handleRetry}
								>
									<svg
										class="retry-icon"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<title>Retry</title>
										<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
										<path d="M3 3v5h5" />
									</svg>
									{t("web.watchRetry")}
								</CornerCutButton>
							)}
							<CornerCutButton
								color={ACCENT}
								variant="outline"
								size="xs"
								onClick={handleWatch}
							>
								{t("web.watchNow")}
							</CornerCutButton>
						</>
					) : null}
					<CornerCutButton
						color="#ff4444"
						variant="ghost"
						size="xs"
						onClick={handleDelete}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<title>Delete</title>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</CornerCutButton>
				</div>
			</div>
			{renderBuild()}
		</BorderBeamCornerCutCard>
	);
};

const HistoryList: FC<{ s: State; d: (a: Action) => void }> = ({ s, d }) => {
	const handleClear = async () => {
		await fetch("/watch/api/history", { method: "DELETE" });
		d({ type: "CLEAR_HISTORY_DONE" });
	};

	return (
		<div class="history-section">
			<div style="margin-bottom:12px">
				{sectionTitle(ACCENT, t("web.historyTitle"))}
			</div>
			{s.history.length > 0 ? (
				<div class="history-list">
					{s.history.map((entry) => (
						<HistoryBuildItem key={entry.id} entry={entry} s={s} d={d} />
					))}
				</div>
			) : (
				<div class="empty-hint">
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.noHistory")}
					</NeonGlow>
				</div>
			)}
			{s.history.length > 0 && (
				<div class="history-footer">
					{s.clearConfirm ? (
						<div style="display:flex;align-items:center;gap:8px">
							<NeonGlow colors={ACCENT} glowIntensity="subtle">
								<span style="font-size:12px">{t("web.clearConfirm")}</span>
							</NeonGlow>
							<CornerCutButton
								color="#ff4444"
								variant="ghost"
								size="sm"
								onClick={handleClear}
							>
								{t("web.clearHistory")}
							</CornerCutButton>
							<CornerCutButton
								color={ACCENT}
								variant="ghost"
								size="sm"
								onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
							>
								{t("web.cancel")}
							</CornerCutButton>
						</div>
					) : (
						<CornerCutButton
							color={ACCENT}
							variant="ghost"
							size="sm"
							onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
						>
							{t("web.clearHistory")}
						</CornerCutButton>
					)}
				</div>
			)}
		</div>
	);
};

const BuildPanel: FC<{
	buildStatus: BuildStatus;
	buildInfo: JenkinsBuildInfo | null;
	buildError: string;
	polling: boolean;
	selectedJob?: JenkinsJob | null;
	onStopPoll?: () => void;
	onReselectJob?: () => void;
}> = ({
	buildStatus,
	buildInfo: bi,
	buildError,
	polling,
	selectedJob,
	onStopPoll,
	onReselectJob,
}) => {
	if (buildStatus === "idle") return null;

	if (buildStatus === "polling") {
		return (
			<NeonGlowCornerCutCard
				className="build-section-card"
				colorA={ACCENT}
				size="sm"
				hoverEffect="glow-only"
			>
				<div class="loading-row">
					<span class="spinner" />
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.watchFetchingBuild")}
					</NeonGlow>
				</div>
			</NeonGlowCornerCutCard>
		);
	}

	if (buildStatus === "error") {
		return (
			<NeonGlowCornerCutCard
				className="build-section-card"
				colorA={ERROR_COLOR}
				size="sm"
				hoverEffect="glow-only"
			>
				<div class="build-top">
					<Badge
						color="#ff4444"
						variant="ghost"
						shape="pill"
						size="sm"
						glow
						dot="solid"
					>
						{t("web.watchBuildError")}
					</Badge>
				</div>
				<div class="error-text" role="alert" style="margin-top:0">
					<NeonGlow colors={ERROR_COLOR} glowIntensity="subtle">
						{buildError}
					</NeonGlow>
				</div>
			</NeonGlowCornerCutCard>
		);
	}

	if (buildStatus === "no-build") {
		return (
			<NeonGlowCornerCutCard
				className="build-section-card"
				colorA={ACCENT}
				size="sm"
				hoverEffect="glow-only"
			>
				<div class="empty-hint" style="padding:16px">
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.watchNoBuild")}
					</NeonGlow>
				</div>
			</NeonGlowCornerCutCard>
		);
	}

	if (!bi) return null;

	const statusClass = bi.building
		? "building"
		: bi.result === "SUCCESS"
			? "success"
			: bi.result === "FAILURE"
				? "failure"
				: "aborted";
	const statusLabel = bi.building
		? t("web.watchBuilding")
		: bi.result === "SUCCESS"
			? t("web.watchBuildSuccess")
			: bi.result === "FAILURE"
				? t("web.watchBuildFailed")
				: (bi.result ?? t("web.watchBuildUnknown"));
	const panelColor =
		statusClass === "failure" || statusClass === "aborted"
			? ERROR_COLOR
			: ACCENT;
	const statusColor =
		statusClass === "failure"
			? "#ff4444"
			: statusClass === "aborted"
				? "#ffaa00"
				: statusClass === "building"
					? ACCENT
					: "#39ff14";

	return (
		<NeonGlowCornerCutCard
			className="build-section-card"
			colorA={panelColor}
			size="sm"
			hoverEffect="glow-only"
		>
			{/* Top bar: status badge + action buttons */}
			<div class="build-top">
				<div class="build-top-left">
					<Badge
						color={statusColor}
						variant="ghost"
						shape="pill"
						size="sm"
						glow
						dot={statusClass === "building" ? "pulse" : "solid"}
					>
						{statusLabel}
					</Badge>
					{selectedJob && !bi.building && onReselectJob && (
						<span title={t("web.watchClickToReselectJob")}>
							<CornerCutButton
								color={ACCENT}
								variant="outline"
								onClick={onReselectJob}
							>
								{selectedJob.name}
							</CornerCutButton>
						</span>
					)}
				</div>
				<div class="build-top-right">
					{polling && !bi.building && onStopPoll && (
						<CornerCutButton
							color="#ff4444"
							variant="ghost"
							size="xs"
							onClick={onStopPoll}
						>
							<svg
								width="8"
								height="8"
								viewBox="0 0 24 24"
								fill="currentColor"
								stroke="none"
							>
								<title>Stop</title>
								<rect x="4" y="4" width="16" height="16" rx="2" />
							</svg>
							{t("web.watchStopPolling")}
						</CornerCutButton>
					)}
				</div>
			</div>

			{/* Meta grid: Build # / Duration / Time — full width */}
			<div class="build-meta-grid">
				<div class="build-meta-cell">
					<div class="build-meta-label">
						{fieldLabel(ACCENT, t("web.watchBuild"))}
					</div>
					<div class="build-meta-value">
						<a href={bi.url} target="_blank" rel="noreferrer">
							<NeonGlow colors={ACCENT} glowIntensity="subtle">
								#{bi.number}
							</NeonGlow>
						</a>
					</div>
				</div>
				<div class="build-meta-cell">
					<div class="build-meta-label">
						{fieldLabel(ACCENT, t("web.watchDuration"))}
					</div>
					<div class="build-meta-value">
						<NeonGlow colors={ACCENT} glowIntensity="subtle">
							{!bi.building && bi.duration > 0
								? formatDuration(bi.duration)
								: "—"}
						</NeonGlow>
					</div>
				</div>
				<div class="build-meta-cell">
					<div class="build-meta-label">
						{fieldLabel(ACCENT, t("web.watchBuildTime"))}
					</div>
					<div class="build-meta-value">
						<NeonGlow colors={ACCENT} glowIntensity="subtle">
							{bi.timestamp > 0 ? formatBuildTime(bi.timestamp) : "—"}
						</NeonGlow>
					</div>
				</div>
			</div>

			{/* Polling indicator */}
			{bi.building && (
				<div class="build-polling-bar">
					<span
						class="spinner"
						style="width:10px;height:10px;border-width:1px"
					/>
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.watchPollingHint")}
					</NeonGlow>
				</div>
			)}

			{/* Artifacts — full width grid */}
			{!bi.building && bi.artifacts && bi.artifacts.length > 0 && (
				<div class="artifacts-list">
					<div class="artifacts-title">
						<NeonGlow colors={ACCENT} glowIntensity="subtle">
							{t("web.watchArtifacts")} ({bi.artifacts.length})
						</NeonGlow>
					</div>
					<div class="artifacts-grid">
						{bi.artifacts.map((a) => {
							const artifactUrl = `${bi.url}artifact/${a.relativePath}`;
							return (
								<div class="artifact-item">
									<span class="artifact-icon">
										<svg
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<title>Artifact</title>
											<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
											<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
											<line x1="12" y1="22.08" x2="12" y2="12" />
										</svg>
									</span>
									<a
										class="artifact-link"
										href={artifactUrl}
										target="_blank"
										rel="noreferrer"
										title={a.fileName || a.relativePath}
									>
										<NeonGlow colors={ACCENT} glowIntensity="subtle">
											{a.fileName || a.relativePath}
										</NeonGlow>
									</a>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</NeonGlowCornerCutCard>
	);
};

// ── Quick Search Tab ───────────────────────────────────────────

const QuickTab: FC<{ s: State; d: (a: Action) => void }> = ({ s, d }) => {
	useChainPolling({
		active: s.quickPolling,
		jobName: s.quickSelectedJob?.name,
		onResult: (info) =>
			d({ type: "QUICK_BUILD_RESULT", info: info as JenkinsBuildInfo }),
		onError: (error) => d({ type: "QUICK_BUILD_ERROR", error }),
		restartToken: s.quickPollingStartedAt,
	});

	const handleConfirmWatch = async () => {
		if (!s.quickSelectedJob) return;
		const jobName = s.quickSelectedJob.name;
		const histRes = await fetch("/watch/api/history");
		const histData = await histRes.json();
		const existingEntry = histData.find(
			(e: WatchHistoryEntry) => e.jenkinsJobName === jobName,
		);
		d({ type: "SET_HISTORY", history: histData });
		if (!existingEntry) {
			await fetch("/watch/api/history", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: Date.now().toString(36),
					createdAt: new Date().toISOString(),
					projectId: 0,
					projectName: "",
					projectPath: "",
					branch: "",
					jenkinsJobName: jobName,
				}),
			});
			const newHistRes = await fetch("/watch/api/history");
			const newHistData = await newHistRes.json();
			d({ type: "SET_HISTORY", history: newHistData });
		}
		d({ type: "QUICK_BUILD_START" });
	};

	return (
		<div class="quick-section">
			<NeonSelect
				id="quick-job"
				color={ACCENT}
				label={t("web.watchSelectJob")}
				placeholder={t("web.watchSelectJobPlaceholder")}
				searchPlaceholder={t("web.watchFilterJobs")}
				loading={s.quickJobsLoading}
				emptyText={
					s.quickJobsLoading ? undefined : t("web.watchNoMatchingJobs")
				}
				items={s.quickJobs}
				value={s.quickSelectedJob}
				isEqual={(a, b) => a.name === b.name}
				onSelect={(item) => d({ type: "QUICK_SELECT_JOB", job: item })}
				renderItem={(item, _isActive) => (
					<span>
						<div class="sel-item-name">{item.name}</div>
						{item.fullName && item.fullName !== item.name && (
							<div class="sel-item-sub">{item.fullName}</div>
						)}
					</span>
				)}
			/>

			{s.quickSelectedJob &&
				!s.quickPolling &&
				s.quickBuildStatus === "idle" && (
					<div style="margin-bottom:16px">
						<NeonGlowCornerCutCard
							className="job-name-display-card"
							colorA={ACCENT}
							size="sm"
							hoverEffect="glow-only"
						>
							<div style="display:flex;align-items:center;gap:12px">
								{fieldLabel(ACCENT, t("web.watchSelectedJob"))}
								<NeonGlow colors={ACCENT} glowIntensity="subtle">
									<span
										style={`font-family:var(--mono);font-size:14px;font-weight:600;color:`}
									>
										{s.quickSelectedJob.name}
									</span>
								</NeonGlow>
							</div>
						</NeonGlowCornerCutCard>
						<CornerCutButton
							color={ACCENT}
							variant="solid"
							onClick={handleConfirmWatch}
						>
							{t("web.watchConfirmStart")}
						</CornerCutButton>
					</div>
				)}

			{s.quickSelectedJob && (
				<BuildPanel
					buildStatus={s.quickBuildStatus}
					buildInfo={s.quickBuildInfo}
					buildError={s.quickBuildError}
					polling={s.quickPolling}
					selectedJob={s.quickSelectedJob}
					onStopPoll={() => d({ type: "QUICK_BUILD_RESET" })}
					onReselectJob={() => d({ type: "QUICK_BUILD_RESET" })}
				/>
			)}
		</div>
	);
};

const WatchFlow: FC<{ s: State; d: (a: Action) => void }> = ({ s, d }) => {
	const handleSelectProject = (project: Project) => {
		d({ type: "SELECT_PROJECT", project });
		d({ type: "BRANCHES_LOADING" });
		fetch(`/watch/api/projects/${project.id}/branches`)
			.then((r) => r.json())
			.then((data: Branch[] | { error: string }) => {
				const list = "error" in data ? [] : (data as Branch[]);
				d({ type: "BRANCHES_LOADED", branches: list });
				const def = list.find((b) => b.default);
				if (def) {
					d({ type: "SELECT_BRANCH", branch: def.name });
				}
			})
			.catch(() => d({ type: "BRANCHES_LOADED", branches: [] }));
	};

	useEffect(() => {
		fetch("/watch/api/projects")
			.then((r) => r.json())
			.then((data) => {
				if (data.error) {
					d({ type: "PROJECTS_ERROR", error: data.error });
					return;
				}
				d({ type: "PROJECTS_LOADED", projects: data });
				const projectPath = new URLSearchParams(window.location.search).get(
					"project",
				);
				if (projectPath && Array.isArray(data)) {
					const match = data.find(
						(p: Project) => (p.pathWithNamespace ?? "") === projectPath,
					);
					if (match) {
						handleSelectProject(match as Project);
					}
				}
			})
			.catch((e) => d({ type: "PROJECTS_ERROR", error: e.message }));
	}, []);

	useEffect(() => {
		if (!s.selected || s.pomInfo || s.pomLoading || s.pomError) return;
		if (!s.selectedBranch) return;
		d({ type: "POM_LOADING" });
		fetch(
			`/watch/api/projects/${s.selected.id}/pom-info?ref=${encodeURIComponent(s.selectedBranch)}`,
		)
			.then((r) => r.json())
			.then((data: PomInfo | { error: string }) => {
				if ("error" in data) d({ type: "POM_ERROR", error: data.error });
				else d({ type: "POM_LOADED", info: data as PomInfo });
			})
			.catch(() => d({ type: "POM_ERROR", error: "Failed to fetch pom.xml" }));
	}, [s.selected?.id, s.selectedBranch, s.pomInfo, s.pomLoading, s.pomError]);

	const step1Done = !!s.selected;
	const step1Active = !s.projectsLoading && !step1Done;
	const step2Done = !!s.selectedBranch;
	const step2Active = !!s.selected && !step2Done;
	const step3Done = !!s.pomInfo && !!s.jenkinsJobName;
	const step3Active = !!s.selectedBranch && !step3Done;
	const stepVariant = (done: boolean, active: boolean) =>
		done ? "solid" : active ? "outline" : "ghost";

	if (s.projectsLoading) {
		return (
			<div
				class="loading-row"
				style="flex-direction:column;align-items:stretch;gap:8px"
			>
				<NeonGlow colors={ACCENT} glowIntensity="subtle">
					{t("web.loadingProjects")}
				</NeonGlow>
				<ProgressBar
					value={100}
					variant="striped"
					pulse
					color={ACCENT}
					size="sm"
					glow
				/>
			</div>
		);
	}
	if (s.projectsError)
		return (
			<div class="error-text" role="alert">
				<NeonGlow colors={ERROR_COLOR} glowIntensity="subtle">
					{s.projectsError}
				</NeonGlow>
			</div>
		);

	return (
		<div>
			<div class="watch-steps">
				<Badge
					color={ACCENT}
					variant={stepVariant(step1Done, step1Active)}
					shape="corner-cut"
					size="sm"
					glow={step1Done || step1Active}
				>
					{t("web.projectLabel")}
				</Badge>
				<span class="watch-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={stepVariant(step2Done, step2Active)}
					shape="corner-cut"
					size="sm"
					glow={step2Done || step2Active}
				>
					{t("web.branchLabel")}
				</Badge>
				<span class="watch-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={stepVariant(step3Done, step3Active)}
					shape="corner-cut"
					size="sm"
					glow={step3Done || step3Active}
				>
					{t("web.watchJobName")}
				</Badge>
			</div>

			<NeonSelect
				id="project"
				color={ACCENT}
				label={t("web.projectLabel")}
				placeholder={t("web.selectProject")}
				searchPlaceholder={t("web.searchProjects")}
				emptyText={t("web.noProjects")}
				items={s.projects}
				value={s.selected}
				isEqual={(a, b) => a.id === b.id}
				onSelect={handleSelectProject}
				renderItem={(item) => (
					<>
						<div class="sel-item-name">{item.name}</div>
						<div class="sel-item-sub">{item.pathWithNamespace}</div>
					</>
				)}
			/>

			{s.selected && (s.branchesLoading || s.branches.length > 0) && (
				<NeonSelect
					id="branch"
					color={ACCENT}
					label={t("web.branchLabel")}
					placeholder={t("web.selectBranch")}
					loading={s.branchesLoading}
					searchPlaceholder={t("web.filterBranches")}
					emptyText={t("web.noBranches")}
					items={s.branches}
					value={s.selectedBranch ? { name: s.selectedBranch } : null}
					onSelect={(item) => d({ type: "SELECT_BRANCH", branch: item.name })}
					renderItem={(item) => (
						<>
							<span class="sel-item-name">{item.name}</span>
							{item.default && (
								<Badge
									color={ACCENT}
									variant="outline"
									shape="pill"
									size="xs"
									className="sel-item-default"
								>
									{t("web.defaultBranch")}
								</Badge>
							)}
						</>
					)}
				/>
			)}

			{s.selected &&
				s.selectedBranch &&
				!s.branchesLoading &&
				(s.pomLoading ? (
					<div
						class="loading-row"
						style="flex-direction:column;align-items:stretch;gap:8px"
					>
						<NeonGlow colors={ACCENT} glowIntensity="subtle">
							{t("web.watchFetchingPom")}
						</NeonGlow>
						<ProgressBar
							value={100}
							variant="striped"
							pulse
							color={ACCENT}
							size="sm"
							glow
						/>
					</div>
				) : s.pomError || (s.pomInfo && !s.jenkinsJobName) ? (
					<NeonGlowCornerCutCard
						className="pom-fallback-card"
						colorA={ACCENT}
						size="sm"
						hoverEffect="glow-only"
					>
						<div style="display:flex;flex-direction:column;gap:8px">
							<NeonGlow colors={ACCENT} glowIntensity="subtle">
								{t("web.watchPomFallbackHint")}
							</NeonGlow>
							{s.pomError && !s.pomError.includes("404") && (
								<div class="error-text" role="alert" style="margin-top:0">
									<NeonGlow colors={ERROR_COLOR} glowIntensity="subtle">
										{s.pomError}
									</NeonGlow>
								</div>
							)}
							<NeonSelect
								id="manual-job"
								color={ACCENT}
								label={t("web.watchSelectJob")}
								placeholder={t("web.watchSelectJobPlaceholder")}
								searchPlaceholder={t("web.watchFilterJobs")}
								loading={s.quickJobsLoading}
								emptyText={
									s.quickJobsLoading ? undefined : t("web.watchNoMatchingJobs")
								}
								items={s.quickJobs}
								value={s.selectedJob}
								isEqual={(a, b) => a.name === b.name}
								onSelect={(item) =>
									d({ type: "MANUAL_JOB_SELECTED", job: item })
								}
								renderItem={(item) => (
									<span>
										<div class="sel-item-name">{item.name}</div>
										{item.fullName && item.fullName !== item.name && (
											<div class="sel-item-sub">{item.fullName}</div>
										)}
									</span>
								)}
							/>
						</div>
					</NeonGlowCornerCutCard>
				) : null)}

			{!s.selected && (
				<div class="empty-hint">
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.watchEmptyHint")}
					</NeonGlow>
				</div>
			)}
		</div>
	);
};

const WatchClient: FC = () => {
	const [s, d] = useReducer(reducer, initial);

	useEffect(() => {
		fetch("/watch/api/history")
			.then((r) => r.json())
			.then((data) =>
				d({ type: "SET_HISTORY", history: Array.isArray(data) ? data : [] }),
			)
			.catch(() => d({ type: "SET_HISTORY", history: [] }));
		// Auto-switch to "project" tab if URL has `?project=` (CLI: `watch -o`)
		const projectPath = new URLSearchParams(window.location.search).get(
			"project",
		);
		if (projectPath) {
			d({ type: "SET_ACTIVE_TAB", tab: "project" });
		}
	}, []);

	// Eager-load Jenkins jobs on page entry (consistent with MR project search)
	useEffect(() => {
		if (s.quickJobs.length > 0 || s.quickJobsLoading) return;
		d({ type: "QUICK_JOBS_LOADING" });
		fetch("/watch/api/jenkins/search")
			.then((r) => r.json())
			.then(
				(
					jobs: {
						name: string;
						url: string;
						color: string;
						fullName?: string;
					}[],
				) => d({ type: "QUICK_JOBS_LOADED", jobs }),
			)
			.catch(() => d({ type: "QUICK_JOBS_LOADED", jobs: [] }));
	}, [s.quickJobs.length, s.quickJobsLoading]);

	// Auto-trigger monitoring when jenkinsJobName becomes available (POM loaded or project name fallback)
	// Save to history (or trigger existing entry) and start polling automatically
	const autoTriggeredRef = useRef<string | null>(null);
	useEffect(() => {
		if (!s.jenkinsJobName || !s.selectedBranch) {
			if (!s.jenkinsJobName) autoTriggeredRef.current = null;
			return;
		}
		if (autoTriggeredRef.current === s.jenkinsJobName) return;
		autoTriggeredRef.current = s.jenkinsJobName;

		const jobName = s.jenkinsJobName;

		fetch("/watch/api/history")
			.then((r) => r.json())
			.then((histData) => {
				d({ type: "SET_HISTORY", history: histData });
				const existingEntry = histData.find(
					(e: WatchHistoryEntry) => e.jenkinsJobName === jobName,
				);

				if (existingEntry) {
					d({ type: "HISTORY_BUILD_START", id: existingEntry.id });
				} else {
					fetch("/watch/api/history", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							id: Date.now().toString(36),
							createdAt: new Date().toISOString(),
							projectId: s.selected?.id ?? 0,
							projectName: s.selected?.name ?? "",
							projectPath: s.selected?.pathWithNamespace ?? "",
							branch: s.selectedBranch,
							jenkinsJobName: jobName,
						}),
					})
						.then(() => fetch("/watch/api/history"))
						.then((r) => r.json())
						.then((newHistData) => {
							d({ type: "SET_HISTORY", history: newHistData });
							const entryId = newHistData.find(
								(e: WatchHistoryEntry) => e.jenkinsJobName === jobName,
							)?.id;
							if (entryId) {
								d({ type: "HISTORY_BUILD_START", id: entryId });
							}
						});
				}
			})
			.catch(() => {});
	}, [s.jenkinsJobName, s.selectedBranch, s.selected?.id]);

	return (
		<div>
			<style>{watchStyle}</style>
			<PageHeader
				title={
					<GlitchText
						neon
						mode="active"
						colorA={ACCENT}
						colorB={ACCENT}
						glowColor={ACCENT}
						speed="slow"
						style="color:#bf00ff"
					>
						{t("web.watchTitle")}
					</GlitchText>
				}
				description={
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.watchDesc")}
					</NeonGlow>
				}
			/>

			{/* Tab bar */}
			<NeonGlowCornerCutCard
				className="watch-tabs-card"
				colorA={ACCENT}
				size="sm"
				hoverEffect="glow-only"
			>
				<CornerCutButton
					color={ACCENT}
					size="sm"
					variant={s.activeTab === "quick" ? "solid" : "ghost"}
					corner="all"
					hoverEffect="glow"
					className={`watch-tab-cta${s.activeTab === "quick" ? " is-active" : ""}`}
					onClick={() => d({ type: "SET_ACTIVE_TAB", tab: "quick" })}
				>
					{t("web.watchQuickTab")}
				</CornerCutButton>
				<CornerCutButton
					color={ACCENT}
					size="sm"
					variant={s.activeTab === "project" ? "solid" : "ghost"}
					corner="all"
					hoverEffect="glow"
					className={`watch-tab-cta${s.activeTab === "project" ? " is-active" : ""}`}
					onClick={() => d({ type: "SET_ACTIVE_TAB", tab: "project" })}
				>
					{t("web.watchProjectTab")}
				</CornerCutButton>
			</NeonGlowCornerCutCard>

			{/* Tab content */}
			{s.activeTab === "quick" && <QuickTab s={s} d={d} />}
			{s.activeTab === "project" && <WatchFlow s={s} d={d} />}

			{/* History - always visible */}
			{s.historyLoading ? (
				<div class="loading-row">
					<span class="spinner" />
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.loading")}
					</NeonGlow>
				</div>
			) : (
				<HistoryList s={s} d={d} />
			)}
		</div>
	);
};

export const mount = async (el: HTMLElement) => {
	await initPromise;
	render(<WatchClient />, el);
};
