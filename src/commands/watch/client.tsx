import { type FC, useEffect, useReducer, useRef } from "hono/jsx";
import { render } from "hono/jsx/dom";
import i18next from "i18next";
import { commonCss } from "../../shared/components/common";
import {
	pipelineCss,
	pipelineLineClass,
	pipelineStepClass,
} from "../../shared/components/pipeline";
import { selectCss, selKeyDown } from "../../shared/components/select";
import { useChainPolling } from "../../utils/polling";
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

const watchStyle = `${pipelineCss}${selectCss}${commonCss}
  .page-header {
    margin-bottom: 28px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
  }
  .page-header h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 6px; }
  .page-header p { font-size: 13px; color: var(--text-2); font-weight: 300; line-height: 1.5; }

  /* ── Tabs ── */
  .watch-tabs {
    display: inline-flex;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 3px;
    margin-bottom: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
  }
  .watch-tab {
    padding: 8px 20px;
    font-size: 13px;
    font-family: var(--sans);
    font-weight: 500;
    color: var(--text-3);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .watch-tab:hover { color: var(--text-1); }
  .watch-tab.active {
    background: var(--neon);
    color: var(--bg-void);
    box-shadow: 0 0 8px var(--neon-glow);
  }

  /* ── Quick search ── */
  .quick-section {
    position: relative;
    z-index: 10;
    margin-bottom: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }

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
  .sel-trigger:focus, .sel-trigger.open {
    border-color: var(--neon);
    box-shadow: 0 0 0 2px var(--neon-soft), 0 0 8px var(--neon-glow);
  }
  .sel-trigger-label { font-size: 11px; color: var(--text-3, #64748B); flex-shrink: 0; }
  .sel-trigger-value { flex: 1; font-family: var(--mono); font-size: 13px; font-weight: 500; color: var(--text-1); }
  .sel-trigger-value.empty { color: var(--text-3); font-weight: 300; }
  .sel-trigger-arrow { color: var(--text-3); font-size: 10px; transition: transform 0.2s; }
  .sel-trigger.open .sel-trigger-arrow { transform: rotate(180deg); }
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
    color: var(--text-1);
  }
  .sel-item:first-child { border-radius: 7px 7px 0 0; }
  .sel-item:last-child { border-radius: 0 0 7px 7px; }
  .sel-item:hover, .sel-item.highlighted { background: var(--bg-hover); }
  .sel-item.active { background: var(--neon-soft); border-left-color: var(--neon); font-weight: 500; }
  .sel-item-name { font-weight: 500; color: var(--text-1); }
  .sel-item-sub { font-size: 11px; color: var(--text-3); font-family: var(--mono); margin-top: 2px; }
  .sel-empty { padding: 12px; text-align: center; color: var(--text-3); font-size: 12px; }

  .empty-hint { text-align: center; padding: 32px 0; color: var(--text-3); font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
  .state-error { color: var(--error); font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

  .watch-btn {
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
    margin-top: 8px;
    position: relative;
    z-index: 1;
  }
  .watch-btn:hover { background: var(--neon-hover); box-shadow: 0 0 12px var(--neon-glow); }
  .watch-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .watch-btn.danger { background: var(--error); }
  .watch-btn.secondary { background: transparent; color: var(--text-2); border: 1px solid var(--border); }
  .watch-btn.secondary:hover { border-color: var(--text-2); color: var(--text-1); }
  .watch-btn.stop {
    width: auto;
    min-height: 0;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 400;
    color: var(--text-3);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    margin: 0;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .watch-btn.stop:hover {
    color: var(--error);
    border-color: rgba(255,68,68,0.3);
    background: rgba(255,68,68,0.06);
    box-shadow: none;
  }

  /* ── History item layout ── */
  .history-item {
    position: relative;
  }
  .history-info {
    min-width: 0;
    flex: 1;
  }
  .history-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .history-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    font-family: var(--sans);
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .history-action-btn.primary {
    color: var(--neon);
    background: var(--neon-soft);
    border: 1px solid rgba(0, 255, 136, 0.15);
  }
  .history-action-btn.primary:hover {
    background: rgba(0, 255, 136, 0.12);
    border-color: rgba(0, 255, 136, 0.3);
  }
  .history-action-btn.secondary {
    color: var(--text-2);
    background: transparent;
    border: 1px solid var(--border);
  }
  .history-action-btn.secondary:hover {
    color: var(--text-1);
    background: var(--bg-hover);
    border-color: var(--border-active);
  }
  .history-action-btn.retry {
    color: var(--error);
    background: rgba(255, 68, 68, 0.08);
    border: 1px solid rgba(255, 68, 68, 0.15);
  }
  .history-action-btn.retry:hover {
    background: rgba(255, 68, 68, 0.12);
    border-color: rgba(255, 68, 68, 0.3);
  }
  .history-action-btn.delete {
    width: 28px;
    padding: 0;
    color: var(--text-3);
    background: transparent;
    border: 1px solid var(--border);
  }
  .history-action-btn.delete:hover {
    color: var(--error);
    background: rgba(255, 68, 68, 0.08);
    border-color: rgba(255, 68, 68, 0.2);
  }
  .retry-icon {
    display: inline-block;
    width: 14px;
    height: 14px;
    stroke: currentColor;
    vertical-align: middle;
  }
  .watch-btn .stop-icon {
    display: inline-block;
    width: 8px;
    height: 8px;
    background: currentColor;
    border-radius: 2px;
    margin-right: 5px;
    vertical-align: middle;
    opacity: 0.7;
  }

  /* ── Build result ── */
  .build-section {
    margin-top: 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .build-section.building { border-color: rgba(0,212,255,0.2); }
  .build-section.success { border-color: rgba(0,255,136,0.2); }
  .build-section.failure { border-color: rgba(255,68,68,0.2); }
  .build-section.aborted { border-color: rgba(255,170,0,0.2); }

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
  .build-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 11px;
    font-family: var(--mono);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .build-status.success { background: rgba(0,255,136,0.15); color: var(--neon); }
  .build-status.failure { background: rgba(255,68,68,0.15); color: var(--error); }
  .build-status.aborted { background: rgba(255,170,0,0.15); color: #ffaa00; }
  .build-status.building { background: rgba(0,212,255,0.15); color: var(--cyan); animation: neon-pulse 2s ease infinite; }
  .build-status-dot {
    width: 6px; height: 6px; border-radius: 50%;
  }
  .build-status.success .build-status-dot { background: var(--neon); }
  .build-status.failure .build-status-dot { background: var(--error); }
  .build-status.aborted .build-status-dot { background: #ffaa00; }
  .build-status.building .build-status-dot { background: var(--cyan); animation: neon-pulse 1.5s ease infinite; }
  .build-top-right {
    display: flex;
    align-items: center;
    gap: 8px;
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
    color: var(--cyan);
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
    background: rgba(0,212,255,0.04);
    font-size: 12px;
    color: var(--text-3);
    border-top: 1px solid rgba(0,212,255,0.08);
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
    color: var(--cyan);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s;
  }
  .artifact-link:hover { color: var(--neon); }

  .polling-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    padding: 8px 12px;
    background: var(--bg-void);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-3);
  }

  .history-section { margin-bottom: 24px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both; }
  .history-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--text-1); }
  .history-list { display: flex; flex-direction: column; gap: 8px; }
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
  .history-item-row { display: flex; align-items: center; justify-content: space-between; }
  .history-item:hover { border-color: var(--border-active); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .history-info { display: flex; align-items: center; gap: 12px; flex: 1; }
  .history-project { font-weight: 500; color: var(--text-1); font-size: 14px; }
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
  .history-new-btn, .history-clear-btn {
    padding: 8px 16px;
    font-size: 13px;
    font-family: var(--sans);
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .history-new-btn { color: var(--bg-void); background: var(--neon); border: none; }
  .history-new-btn:hover { background: var(--neon-hover); box-shadow: 0 0 12px var(--neon-glow); }
  .history-clear-btn { color: var(--text-3); background: transparent; border: 1px solid var(--border); }
  .history-clear-btn:hover { border-color: var(--error); color: var(--error); }

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
    max-height: 90vh;
    overflow: visible;
    background: var(--bg-void);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
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

  .job-name-display {
    padding: 10px 14px;
    background: var(--bg-card);
    border: 1px solid rgba(0,212,255,0.08);
    border-radius: 8px;
    margin-bottom: 16px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    font-family: var(--mono);
    font-size: 13px;
  }
  .job-name-label { font-size: 11px; color: var(--text-3); font-family: var(--sans); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .job-name-value { color: var(--cyan); font-weight: 600; }
`;

type State = {
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
	jenkinsJobs: JenkinsJob[];
	jenkinsJobsLoading: boolean;
	jenkinsJobName: string;
	jenkinsJobOpen: boolean;
	jenkinsJobSearch: string;
	jenkinsJobIndex: number;
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
	quickSearch: string;
	quickJobs: JenkinsJob[];
	quickJobsLoading: boolean;
	quickJobOpen: boolean;
	quickJobIndex: number;
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
	jenkinsJobs: [],
	jenkinsJobsLoading: false,
	jenkinsJobName: "",
	jenkinsJobOpen: false,
	jenkinsJobSearch: "",
	jenkinsJobIndex: -1,
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
	quickSearch: "",
	quickJobs: [],
	quickJobsLoading: false,
	quickJobOpen: false,
	quickJobIndex: -1,
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
	| { type: "JENKINS_JOBS_LOADING" }
	| { type: "JENKINS_JOBS_LOADED"; jobs: JenkinsJob[] }
	| { type: "SET_JENKINS_JOB_OPEN"; open: boolean }
	| { type: "SET_JENKINS_JOB_SEARCH"; search: string }
	| { type: "SET_JENKINS_JOB_INDEX"; index: number }
	| { type: "SELECT_JENKINS_JOB"; job: JenkinsJob }
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
	| { type: "QUICK_SET_SEARCH"; search: string }
	| { type: "QUICK_SET_JOB_OPEN"; open: boolean }
	| { type: "QUICK_SET_JOB_INDEX"; index: number }
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
				branchOpen: false,
				branchSearch: "",
				branchIndex: -1,
				pomInfo: null,
				pomError: "",
				pomLoading: false,
				jenkinsJobs: [],
				jenkinsJobName: "",
				jenkinsJobOpen: false,
				jenkinsJobSearch: "",
				jenkinsJobIndex: -1,
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
			const jobName = action.info.jenkinsJobName ?? state.selected?.name ?? "";
			return {
				...state,
				pomLoading: false,
				pomInfo: action.info,
				jenkinsJobName: jobName,
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
		case "SET_JENKINS_JOB_OPEN":
			return {
				...state,
				jenkinsJobOpen: action.open,
				...(action.open ? {} : { jenkinsJobSearch: "", jenkinsJobIndex: -1 }),
			};
		case "SET_JENKINS_JOB_SEARCH":
			return { ...state, jenkinsJobSearch: action.search, jenkinsJobIndex: -1 };
		case "SET_JENKINS_JOB_INDEX":
			return { ...state, jenkinsJobIndex: action.index };
		case "SELECT_JENKINS_JOB":
			return {
				...state,
				selectedJob: action.job,
				jenkinsJobOpen: false,
				jenkinsJobSearch: "",
				jenkinsJobIndex: -1,
				buildStatus: "idle",
				buildInfo: null,
				buildError: "",
			};
		case "CLEAR_JENKINS_JOB":
			return {
				...state,
				selectedJob: null,
				jenkinsJobOpen: false,
				jenkinsJobSearch: "",
				jenkinsJobIndex: -1,
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
			return { ...state, buildStatus: status, buildInfo: info };
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
							polling: true,
						}),
						buildStatus: status,
						buildInfo: info,
						buildError: "",
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
		case "QUICK_SET_SEARCH":
			return { ...state, quickSearch: action.search, quickJobIndex: -1 };
		case "QUICK_SET_JOB_OPEN":
			return {
				...state,
				quickJobOpen: action.open,
				...(action.open ? {} : { quickSearch: "", quickJobIndex: -1 }),
			};
		case "QUICK_SET_JOB_INDEX":
			return { ...state, quickJobIndex: action.index };
		case "QUICK_SELECT_JOB":
			return {
				...state,
				quickSelectedJob: action.job,
				quickJobOpen: false,
				quickSearch: "",
				quickJobIndex: -1,
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
		await fetch(`/watch/api/history/${encodeURIComponent(id)}`, {
			method: "DELETE",
		});
		d({ type: "REMOVE_HISTORY_ENTRY", id });
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
				<div class="build-section building" style="margin-top:12px">
					<div class="build-top">
						<div class="build-top-left">
							<span class="build-status building">
								<span class="build-status-dot" />
								{t("web.watchFetchingBuild")}
							</span>
						</div>
					</div>
				</div>
			);
		}
		if (status === "error") {
			return (
				<div class="build-section failure" style="margin-top:12px">
					<div class="build-top">
						<div class="build-top-left">
							<span class="build-status failure">
								<span class="build-status-dot" />
								{t("web.watchBuildError")}
							</span>
						</div>
						<button class="watch-btn stop" type="button" onClick={handleStop}>
							<svg
								width="8"
								height="8"
								viewBox="0 0 24 24"
								fill="currentColor"
								stroke="none"
							>
								<rect x="4" y="4" width="16" height="16" rx="2" />
							</svg>
							{t("web.watchStopPolling")}
						</button>
					</div>
					<div style="padding:10px 14px;font-size:12px;color:var(--error)">
						{build.buildError}
					</div>
				</div>
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

		return (
			<div class={`build-section ${statusClass}`} style="margin-top:12px">
				<div class="build-top">
					<div class="build-top-left">
						<span class={`build-status ${statusClass}`}>
							<span class="build-status-dot" />
							{statusLabel}
						</span>
					</div>
					<button class="watch-btn stop" type="button" onClick={handleStop}>
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
					</button>
				</div>
				<div class="build-meta-grid">
					<div class="build-meta-cell">
						<div class="build-meta-label">{t("web.watchBuild")}</div>
						<div class="build-meta-value" style="font-size:12px">
							<a href={bi.url} target="_blank" rel="noreferrer">
								#{bi.number}
							</a>
						</div>
					</div>
					<div class="build-meta-cell">
						<div class="build-meta-label">{t("web.watchDuration")}</div>
						<div class="build-meta-value" style="font-size:12px">
							{!bi.building && bi.duration > 0
								? formatDuration(bi.duration)
								: "—"}
						</div>
					</div>
					<div class="build-meta-cell">
						<div class="build-meta-label">{t("web.watchBuildTime")}</div>
						<div class="build-meta-value" style="font-size:12px">
							{bi.timestamp > 0 ? formatBuildTime(bi.timestamp) : "—"}
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
						{t("web.watchPollingHint")}
					</div>
				)}
				{!bi.building && bi.artifacts && bi.artifacts.length > 0 && (
					<div class="artifacts-list" style="padding:10px 12px">
						<div
							class="artifacts-title"
							style="font-size:9px;margin-bottom:6px"
						>
							{t("web.watchArtifacts")}
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
										{a.fileName || a.relativePath}
									</a>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		);
	};

	return (
		<div class="history-item">
			<div class="history-item-row">
				<div class="history-info">
					<span class="history-project" style="font-size:15px">
						{entry.jenkinsJobName}
					</span>
					<span class="history-detail" style="font-size:11px;opacity:0.7">
						{entry.projectName} · {entry.branch}
					</span>
				</div>
				<div class="history-actions">
					{status === "idle" ? (
						<button
							class="history-action-btn primary"
							type="button"
							onClick={handleWatch}
						>
							{t("web.watchNow")}
						</button>
					) : status === "error" ||
						status === "success" ||
						status === "failure" ||
						status === "aborted" ? (
						<>
							{(status === "failure" ||
								status === "aborted" ||
								status === "error") && (
								<button
									class="history-action-btn retry"
									type="button"
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
										<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
										<path d="M3 3v5h5" />
									</svg>
									{t("web.watchRetry")}
								</button>
							)}
							<button
								class="history-action-btn secondary"
								type="button"
								onClick={handleWatch}
							>
								{t("web.watchNow")}
							</button>
						</>
					) : null}
					<button
						class="history-action-btn delete"
						type="button"
						onClick={handleDelete}
						title={t("web.watchDeleteHistory")}
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
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			</div>
			{renderBuild()}
		</div>
	);
};

const HistoryList: FC<{ s: State; d: (a: Action) => void }> = ({ s, d }) => {
	const handleClear = async () => {
		await fetch("/watch/api/history", { method: "DELETE" });
		d({ type: "CLEAR_HISTORY_DONE" });
	};

	return (
		<div class="history-section">
			<div class="history-title">{t("web.historyTitle")}</div>
			{s.history.length > 0 ? (
				<div class="history-list">
					{s.history.map((entry) => (
						<HistoryBuildItem key={entry.id} entry={entry} s={s} d={d} />
					))}
				</div>
			) : (
				<div class="empty-hint">{t("web.noHistory")}</div>
			)}
			{s.history.length > 0 && (
				<div class="history-footer">
					{s.clearConfirm ? (
						<div style="display:flex;align-items:center;gap:8px">
							<span style="font-size:12px;color:var(--text-3)">
								{t("web.clearConfirm")}
							</span>
							<button
								class="history-clear-btn"
								type="button"
								style="border-color:var(--error);color:var(--error)"
								onClick={handleClear}
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
			<div class="build-section">
				<div class="loading-row">
					<span class="spinner" />
					{t("web.watchFetchingBuild")}
				</div>
			</div>
		);
	}

	if (buildStatus === "error") {
		return (
			<div class="build-section result-error">
				<div class="build-header">
					<span class="build-status failure">{t("web.watchBuildError")}</span>
				</div>
				<div style="color:var(--error);font-size:13px">{buildError}</div>
			</div>
		);
	}

	if (buildStatus === "no-build") {
		return (
			<div class="build-section">
				<div style="color:var(--text-3);font-size:13px">
					{t("web.watchNoBuild")}
				</div>
			</div>
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

	return (
		<div
			class={`build-section ${bi.building ? "building" : bi.result === "SUCCESS" ? "success" : bi.result === "FAILURE" ? "failure" : bi.result === "ABORTED" ? "aborted" : ""}`}
		>
			{/* Top bar: status badge + action buttons */}
			<div class="build-top">
				<div class="build-top-left">
					<span class={`build-status ${statusClass}`}>
						<span class="build-status-dot" />
						{statusLabel}
					</span>
					{selectedJob && !bi.building && onReselectJob && (
						<button
							class="watch-btn secondary"
							type="button"
							style="width:auto;padding:3px 10px;font-size:11px;margin:0"
							onClick={onReselectJob}
							title={t("web.watchClickToReselectJob")}
						>
							{selectedJob.name}
						</button>
					)}
				</div>
				<div class="build-top-right">
					{polling && !bi.building && onStopPoll && (
						<button class="watch-btn stop" type="button" onClick={onStopPoll}>
							<svg
								width="8"
								height="8"
								viewBox="0 0 24 24"
								fill="currentColor"
								stroke="none"
							>
								<rect x="4" y="4" width="16" height="16" rx="2" />
							</svg>
							{t("web.watchStopPolling")}
						</button>
					)}
				</div>
			</div>

			{/* Meta grid: Build # / Duration / Time — full width */}
			<div class="build-meta-grid">
				<div class="build-meta-cell">
					<div class="build-meta-label">{t("web.watchBuild")}</div>
					<div class="build-meta-value">
						<a href={bi.url} target="_blank" rel="noreferrer">
							#{bi.number}
						</a>
					</div>
				</div>
				<div class="build-meta-cell">
					<div class="build-meta-label">{t("web.watchDuration")}</div>
					<div class="build-meta-value">
						{!bi.building && bi.duration > 0
							? formatDuration(bi.duration)
							: "—"}
					</div>
				</div>
				<div class="build-meta-cell">
					<div class="build-meta-label">{t("web.watchBuildTime")}</div>
					<div class="build-meta-value">
						{bi.timestamp > 0 ? formatBuildTime(bi.timestamp) : "—"}
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
					{t("web.watchPollingHint")}
				</div>
			)}

			{/* Artifacts — full width grid */}
			{!bi.building && bi.artifacts && bi.artifacts.length > 0 && (
				<div class="artifacts-list">
					<div class="artifacts-title">
						{t("web.watchArtifacts")} ({bi.artifacts.length})
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
										{a.fileName || a.relativePath}
									</a>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};

// ── Quick Search Tab ───────────────────────────────────────────

const QuickTab: FC<{ s: State; d: (a: Action) => void }> = ({ s, d }) => {
	const jobSearchRef = useRef<HTMLInputElement>(null);

	useChainPolling({
		active: s.quickPolling,
		jobName: s.quickSelectedJob?.name,
		onResult: (info) =>
			d({ type: "QUICK_BUILD_RESULT", info: info as JenkinsBuildInfo }),
		onError: (error) => d({ type: "QUICK_BUILD_ERROR", error }),
		restartToken: s.quickPollingStartedAt,
	});

	// Load quick jobs list when dropdown is opened for the first time
	useEffect(() => {
		if (!s.quickJobOpen || s.quickJobs.length > 0 || s.quickJobsLoading) return;
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
	}, [s.quickJobOpen, s.quickJobs.length, s.quickJobsLoading]);

	// Close dropdown when clicking outside
	useEffect(() => {
		if (!s.quickJobOpen) return;
		const handler = (e: Event) => {
			const target = e.target as HTMLElement;
			if (!target.closest('[data-sel="quick-job"]')) {
				d({ type: "QUICK_SET_JOB_OPEN", open: false });
			}
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [s.quickJobOpen]);

	const handleConfirmWatch = async () => {
		if (!s.quickSelectedJob) return;
		const jobName = s.quickSelectedJob.name;
		// Check if job already exists in history
		const histRes = await fetch("/watch/api/history");
		const histData = await histRes.json();
		const existingEntry = histData.find(
			(e: WatchHistoryEntry) => e.jenkinsJobName === jobName,
		);
		d({ type: "SET_HISTORY", history: histData });
		if (!existingEntry) {
			// Save to history
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
			// Refresh history list
			const newHistRes = await fetch("/watch/api/history");
			const newHistData = await newHistRes.json();
			d({ type: "SET_HISTORY", history: newHistData });
		}
		// Start monitoring in Quick tab (don't reset form)
		d({ type: "QUICK_BUILD_START" });
	};

	const filteredJobs = filterByRelevance(
		s.quickJobs.map((j) => ({ ...j, name: j.name })),
		s.quickSearch,
	);

	return (
		<div class="quick-section">
			<div
				class="sel"
				data-sel="quick-job"
				style={`z-index:${s.quickJobOpen ? 100 : 1}`}
			>
				<button
					class={`sel-trigger${s.quickJobOpen ? " open" : ""}`}
					type="button"
					role="combobox"
					aria-expanded={s.quickJobOpen}
					aria-haspopup="listbox"
					onClick={() => {
						d({ type: "QUICK_SET_JOB_OPEN", open: !s.quickJobOpen });
					}}
				>
					<span class="sel-trigger-label">{t("web.watchSelectJob")}</span>
					<span
						class={`sel-trigger-value${s.quickSelectedJob ? "" : " empty"}`}
					>
						{s.quickSelectedJob
							? s.quickSelectedJob.name
							: t("web.watchSelectJobPlaceholder")}
					</span>
					<span class="sel-trigger-arrow">▼</span>
				</button>
				{s.quickJobOpen && (
					<div
						class="sel-dropdown"
						role="listbox"
						aria-label={t("web.watchSelectJob")}
					>
						<div class="sel-search">
							<input
								ref={jobSearchRef}
								class="sel-search-input"
								type="text"
								placeholder={t("web.watchFilterJobs")}
								value={s.quickSearch}
								onChange={(e: Event) =>
									d({
										type: "QUICK_SET_SEARCH",
										search: (e.target as HTMLInputElement).value,
									})
								}
								onKeyDown={(e: KeyboardEvent) => {
									const n = selKeyDown(
										e,
										true,
										filteredJobs.length,
										s.quickJobIndex,
										(i) => {
											const j = filteredJobs[i];
											if (j)
												d({ type: "QUICK_SELECT_JOB", job: j as JenkinsJob });
										},
										() => d({ type: "QUICK_SET_JOB_OPEN", open: false }),
									);
									if (n !== undefined)
										d({ type: "QUICK_SET_JOB_INDEX", index: n });
								}}
							/>
						</div>
						{s.quickJobsLoading ? (
							<div class="sel-empty">
								<div style="display:flex;align-items:center;justify-content:center;gap:6px">
									<span
										class="spinner"
										style="width:10px;height:10px;border-width:1px"
									/>
									{t("web.watchSearchingJobs")}
								</div>
							</div>
						) : filteredJobs.length > 0 ? (
							filteredJobs.map((j, i) => (
								<div
									class={`sel-item${s.quickSelectedJob?.name === (j as JenkinsJob).name ? " active" : ""}${i === s.quickJobIndex ? " highlighted" : ""}`}
									onMouseEnter={() =>
										d({ type: "QUICK_SET_JOB_INDEX", index: i })
									}
									onClick={() =>
										d({ type: "QUICK_SELECT_JOB", job: j as JenkinsJob })
									}
								>
									<span class="sel-item-name">{(j as JenkinsJob).name}</span>
								</div>
							))
						) : (
							<div class="sel-empty">{t("web.watchNoMatchingJobs")}</div>
						)}
					</div>
				)}
			</div>

			{s.quickSelectedJob &&
				!s.quickPolling &&
				s.quickBuildStatus === "idle" && (
					<div style="margin-bottom:16px">
						<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:10px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px">
							<span style="font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.05em;font-family:var(--mono)">
								{t("web.watchSelectedJob")}
							</span>
							<span style="font-family:var(--mono);font-size:14px;font-weight:600;color:var(--cyan)">
								{s.quickSelectedJob.name}
							</span>
						</div>
						<button
							class="watch-btn"
							type="button"
							onClick={handleConfirmWatch}
						>
							{t("web.watchConfirmStart")}
						</button>
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
	const projectSearchRef = useRef<HTMLInputElement>(null);
	const branchSearchRef = useRef<HTMLInputElement>(null);

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

	const handleSelectBranch = (name: string) => {
		d({ type: "SELECT_BRANCH", branch: name });
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
				// Auto-select project from query param (CLI: `watch -o` passes `?project=path`)
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
		if (!s.projectOpen && !s.branchOpen && !s.jenkinsJobOpen) return;
		const handler = (e: Event) => {
			const target = e.target as HTMLElement;
			if (!target.closest(".sel")) {
				d({ type: "SET_PROJECT_OPEN", open: false });
				d({ type: "SET_BRANCH_OPEN", open: false });
				d({ type: "SET_JENKINS_JOB_OPEN", open: false });
			}
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [s.projectOpen, s.branchOpen, s.jenkinsJobOpen]);

	useEffect(() => {
		if (s.projectOpen) setTimeout(() => projectSearchRef.current?.focus(), 50);
		if (s.branchOpen) setTimeout(() => branchSearchRef.current?.focus(), 50);
		if (s.jenkinsJobOpen) setTimeout(() => jobSearchRef.current?.focus(), 50);
	}, [s.projectOpen, s.branchOpen, s.jenkinsJobOpen]);

	useEffect(() => {
		if (!s.selected || s.pomInfo || s.pomLoading) return;
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
	}, [s.selected, s.selectedBranch, s.pomInfo, s.pomLoading]);

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

	const step1Done = !!s.selected;
	const step1Active = !s.projectsLoading && !step1Done;
	const step2Done = !!s.selectedBranch;
	const step2Active = !!s.selected && !step2Done;
	const step3Done = !!s.pomInfo && !!s.jenkinsJobName;
	const step3Active = !!s.selectedBranch && !step3Done;

	if (s.projectsLoading) {
		return (
			<div class="loading-row">
				<span class="spinner" />
				{t("web.loadingProjects")}
			</div>
		);
	}
	if (s.projectsError) return <div class="state-error">{s.projectsError}</div>;

	return (
		<div>
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
					{t("web.watchJobName")}
				</div>
			</div>

			{/* Project select */}
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

			{/* Branch select */}
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

			{/* POM loading */}
			{s.selected &&
				s.selectedBranch &&
				!s.branchesLoading &&
				(s.pomLoading ? (
					<div class="loading-row">
						<span class="spinner" />
						{t("web.watchFetchingPom")}
					</div>
				) : (
					s.pomError && (
						<div class="state-error">
							{s.pomError.includes("404") ? t("web.noPom") : s.pomError}
						</div>
					)
				))}

			{!s.selected && <div class="empty-hint">{t("web.watchEmptyHint")}</div>}
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
			});
	}, [s.jenkinsJobName, s.selectedBranch, s.selected]);

	return (
		<div>
			<style>{watchStyle}</style>
			<div class="page-header">
				<h2>{t("web.watchTitle")}</h2>
				<p>{t("web.watchDesc")}</p>
			</div>

			{/* Tab bar */}
			<div class="watch-tabs">
				<button
					type="button"
					class={`watch-tab${s.activeTab === "quick" ? " active" : ""}`}
					onClick={() => d({ type: "SET_ACTIVE_TAB", tab: "quick" })}
				>
					{t("web.watchQuickTab")}
				</button>
				<button
					type="button"
					class={`watch-tab${s.activeTab === "project" ? " active" : ""}`}
					onClick={() => d({ type: "SET_ACTIVE_TAB", tab: "project" })}
				>
					{t("web.watchProjectTab")}
				</button>
			</div>

			{/* Tab content */}
			{s.activeTab === "quick" && <QuickTab s={s} d={d} />}
			{s.activeTab === "project" && <WatchFlow s={s} d={d} />}

			{/* History - always visible */}
			{s.historyLoading ? (
				<div class="loading-row">
					<span class="spinner" />
					{t("web.loading")}
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
