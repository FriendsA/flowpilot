import i18next from "i18next";
import { type FC, useEffect, useReducer, useRef } from "hono/jsx";
import { render } from "hono/jsx/dom";
import { filterByRelevance } from "../../utils/search";

// Hydrate i18n from server-inlined data
if (typeof window !== "undefined" && window.__I18N_LOCALE__ && window.__I18N_RESOURCES__) {
	i18next.init({
		lng: window.__I18N_LOCALE__,
		fallbackLng: "zh-CN",
		resources: window.__I18N_RESOURCES__,
		interpolation: { escapeValue: false },
	});
}
const t = i18next.t;

declare global {
	interface Window {
		__I18N_LOCALE__: string;
		__I18N_RESOURCES__: Record<string, { translation: Record<string, unknown> }>;
	}
}

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

  /* ── Generic select ── */
  .sel {
    position: relative;
    margin-bottom: 16px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
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
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
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
    background: var(--bg-content);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 1000;
    animation: dropdown-in 0.12s ease both;
  }
  @keyframes dropdown-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .sel-dropdown::-webkit-scrollbar { width: 6px; }
  .sel-dropdown::-webkit-scrollbar-track { background: transparent; }
  .sel-dropdown::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  .sel-search {
    padding: 8px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg-content);
    z-index: 1;
  }
  .sel-search-input {
    width: 100%;
    padding: 6px 10px;
    font-size: 12px;
    font-family: var(--mono);
    color: var(--text-1);
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 4px;
    outline: none;
    transition: border-color 0.15s;
  }
  .sel-search-input::placeholder { color: var(--text-3); }
  .sel-search-input:focus { border-color: var(--accent); }
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
    background: var(--accent-soft);
    border-left-color: var(--accent);
    font-weight: 500;
  }
  .sel-item-name { font-weight: 500; color: var(--text-1); }
  .sel-item-sub { font-size: 11px; color: var(--text-3); font-family: var(--mono); margin-top: 2px; }
  .sel-empty { padding: 12px; text-align: center; color: var(--text-3); font-size: 12px; }

  /* ── Spinner ── */
  .spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
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
    background: var(--bg-content);
    border: 1px solid var(--border);
    border-radius: 8px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .version-tag { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.05em; font-family: var(--mono); }
  .version-number { font-size: 20px; font-weight: 600; font-family: var(--mono); color: var(--text-1); letter-spacing: -0.01em; }
  .version-error { color: #e05c43; font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

  .empty-hint { text-align: center; padding: 32px 0; color: var(--text-3); font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
  .state-error { color: #e05c43; font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* ── Jira ── */
  .jira-section { margin-top: 20px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .jira-btn {
    width: 100%;
    min-height: 44px;
    padding: 10px 20px;
    font-size: 13px;
    font-family: var(--sans);
    font-weight: 500;
    color: #fff;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.2s;
    margin-top: 16px;
    position: relative;
    z-index: 1;
  }
  .jira-btn:hover { background: #6aaef0; box-shadow: 0 2px 12px rgba(91, 160, 232, 0.25); }
  .jira-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .jira-result {
    margin-top: 12px;
    padding: 12px 16px;
    background: var(--bg-content);
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
    color: var(--accent);
    text-decoration: none;
    border-bottom: 1px dashed rgba(91, 160, 232, 0.3);
    transition: border-color 0.2s;
  }
  .jira-result-key:hover { border-bottom-color: var(--accent); }
  .jira-result-label { font-size: 11px; color: var(--text-3); margin-bottom: 4px; }
  .jira-result-badge { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 500; }
  .jira-result-badge.created { background: var(--green-soft); color: var(--green); }
  .jira-result-badge.exists { background: rgba(91, 160, 232, 0.1); color: var(--accent); }
  .jira-error { margin-top: 12px; color: #e05c43; font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
`;

type Project = { id: number; name: string; path?: string; pathWithNamespace?: string; description?: string; defaultBranch?: string };
type Branch = { name: string; default?: boolean };
type PomInfo = { version: string | null; groupId: string | null; artifactId: string | null };
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
	| { type: "JIRA_DONE"; result: { key: string; exists: boolean; versionName: string } }
	| { type: "JIRA_ERROR"; error: string }
	| { type: "JIRA_RESET" };

const reducer = (state: State, action: Action): State => {
	switch (action.type) {
		case "SET_JIRA_HOST":
			return { ...state, jiraHost: action.host };
		case "PROJECTS_LOADED":
			return { ...state, projects: action.projects, projectsLoading: false };
		case "PROJECTS_ERROR":
			return { ...state, projectsError: action.error, projectsLoading: false };
		case "SET_PROJECT_OPEN":
			return { ...state, projectOpen: action.open, ...(action.open ? {} : { projectSearch: "", projectIndex: -1 }) };
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
			};
		case "BRANCHES_LOADING":
			return { ...state, branchesLoading: true, branches: [], selectedBranch: "" };
		case "BRANCHES_LOADED":
			return { ...state, branches: action.branches, branchesLoading: false };
		case "SET_BRANCH_OPEN":
			return { ...state, branchOpen: action.open, ...(action.open ? {} : { branchSearch: "", branchIndex: -1 }) };
		case "SET_BRANCH_SEARCH":
			return { ...state, branchSearch: action.search, branchIndex: -1 };
		case "SET_BRANCH_INDEX":
			return { ...state, branchIndex: action.index };
		case "SELECT_BRANCH":
			return { ...state, selectedBranch: action.branch, branchOpen: false, branchSearch: "", branchIndex: -1 };
		case "POM_LOADING":
			return { ...state, pomLoading: true, pomError: "", pomInfo: null };
		case "POM_LOADED":
			return { ...state, pomLoading: false, pomInfo: action.info };
		case "POM_ERROR":
			return { ...state, pomLoading: false, pomError: action.error };
		case "JIRA_PROJECTS_LOADING":
			return { ...state, jiraProjectsLoading: true };
		case "JIRA_PROJECTS_LOADED":
			return { ...state, jiraProjects: action.projects, jiraProjectsLoading: false };
		case "JIRA_PROJECTS_ERROR":
			return { ...state, jiraProjectsLoading: false };
		case "SET_JIRA_PROJECT_OPEN":
			return { ...state, jiraProjectOpen: action.open, ...(action.open ? {} : { jiraProjectSearch: "", jiraProjectIndex: -1 }) };
		case "SET_JIRA_PROJECT_SEARCH":
			return { ...state, jiraProjectSearch: action.search, jiraProjectIndex: -1 };
		case "SET_JIRA_PROJECT_INDEX":
			return { ...state, jiraProjectIndex: action.index };
		case "SELECT_JIRA_PROJECT":
			return { ...state, selectedJiraProject: action.project, jiraProjectOpen: false, jiraProjectSearch: "", jiraProjectIndex: -1, jiraStatus: "idle", jiraResult: null, jiraError: "" };
		case "CLEAR_JIRA_PROJECT":
			return { ...state, selectedJiraProject: null, jiraProjectOpen: false, jiraProjectSearch: "", jiraProjectIndex: -1, jiraStatus: "idle", jiraResult: null, jiraError: "" };
		case "JIRA_CHECKING":
			return { ...state, jiraStatus: "checking", jiraResult: null, jiraError: "" };
		case "JIRA_CREATING":
			return { ...state, jiraStatus: "creating" };
		case "JIRA_DONE":
			return { ...state, jiraStatus: "done", jiraResult: action.result };
		case "JIRA_ERROR":
			return { ...state, jiraStatus: "error", jiraError: action.error };
		case "JIRA_RESET":
			return { ...state, jiraStatus: "idle", jiraResult: null, jiraError: "" };
	}
};

// ── Helpers ──

const cleanVersion = (v: string | null) => (v ?? "").split("-")[0];

const selKeyDown = (
	e: KeyboardEvent, open: boolean, len: number, idx: number,
	onSelect: (i: number) => void, onClose: () => void,
): number | undefined => {
	if (!open || len === 0) return undefined;
	switch (e.key) {
		case "ArrowDown": e.preventDefault(); return Math.min(idx + 1, len - 1);
		case "ArrowUp": e.preventDefault(); return Math.max(idx - 1, -1);
		case "Enter": e.preventDefault(); if (idx >= 0) onSelect(idx); return undefined;
		case "Escape": onClose(); return undefined;
	}
	return undefined;
};

// ── Component ──

const ReleaseClient: FC = () => {
	const [s, d] = useReducer(reducer, initial);
	const projectSearchRef = useRef<HTMLInputElement>(null);
	const branchSearchRef = useRef<HTMLInputElement>(null);
	const jiraSearchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		fetch("/release/api/config")
			.then((r) => r.json())
			.then((data) => { if (data.jiraHost) d({ type: "SET_JIRA_HOST", host: data.jiraHost }); })
			.catch(() => {});
	}, []);

	useEffect(() => {
		fetch("/release/api/projects")
			.then((r) => r.json())
			.then((data) => { if (data.error) d({ type: "PROJECTS_ERROR", error: data.error }); else d({ type: "PROJECTS_LOADED", projects: data }); })
			.catch((e) => d({ type: "PROJECTS_ERROR", error: e.message }));
	}, []);

	// Close all dropdowns on outside click
	useEffect(() => {
		if (!s.projectOpen && !s.branchOpen && !s.jiraProjectOpen) return;
		const handler = (e: Event) => {
			const t = e.target as HTMLElement;
			if (!t.closest(".sel")) {
				d({ type: "SET_PROJECT_OPEN", open: false });
				d({ type: "SET_BRANCH_OPEN", open: false });
				d({ type: "SET_JIRA_PROJECT_OPEN", open: false });
			}
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [s.projectOpen, s.branchOpen, s.jiraProjectOpen]);

	// Focus search input when dropdown opens
	useEffect(() => {
		if (s.projectOpen) setTimeout(() => projectSearchRef.current?.focus(), 50);
		if (s.branchOpen) setTimeout(() => branchSearchRef.current?.focus(), 50);
		if (s.jiraProjectOpen) setTimeout(() => jiraSearchRef.current?.focus(), 50);
	}, [s.projectOpen, s.branchOpen, s.jiraProjectOpen]);

	// Fetch Jira projects when pom is loaded
	useEffect(() => {
		if (!s.pomInfo?.version || s.jiraProjects.length > 0 || s.jiraProjectsLoading) return;
		d({ type: "JIRA_PROJECTS_LOADING" });
		fetch("/release/api/jira/projects")
			.then((r) => r.json())
			.then((data) => { if (Array.isArray(data)) d({ type: "JIRA_PROJECTS_LOADED", projects: data }); else d({ type: "JIRA_PROJECTS_ERROR", error: data.error ?? "Failed" }); })
			.catch(() => d({ type: "JIRA_PROJECTS_ERROR", error: "Failed" }));
	}, [s.pomInfo?.version]);

	const fetchPom = (projectId: number, ref: string) => {
		d({ type: "POM_LOADING" });
		fetch(`/release/api/projects/${projectId}/pom-version?ref=${encodeURIComponent(ref)}`)
			.then((r) => r.json())
			.then((data) => { if (data.error) d({ type: "POM_ERROR", error: data.error }); else d({ type: "POM_LOADED", info: data }); })
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
		const artifactId = s.pomInfo.artifactId ?? s.selected.name;
		const projectVersion = cleanVersion(s.pomInfo.version);
		const versionName = `${artifactId}-${projectVersion}`;
		const summary = `${artifactId}-${projectVersion} ${t("web.releaseSuffix") ?? t("release.releaseSuffix")}`;

		d({ type: "JIRA_CHECKING" });
		try {
			const searchRes = await fetch("/release/api/jira/search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jql: `summary ~ "${summary}" AND project = ${s.selectedJiraProject.key}`, maxResults: 1 }),
			});
			const searchData = await searchRes.json();
			if (searchData.error) { d({ type: "JIRA_ERROR", error: searchData.error }); return; }
			if (searchData.total > 0 && searchData.issues?.[0]) {
				d({ type: "JIRA_DONE", result: { key: searchData.issues[0].key, exists: true, versionName } });
				return;
			}

			d({ type: "JIRA_CREATING" });
			const verRes = await fetch("/release/api/jira/ensure-version", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ projectKey: s.selectedJiraProject.key, versionName }),
			});
			const verData = await verRes.json();
			if (verData.error) { d({ type: "JIRA_ERROR", error: verData.error }); return; }

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
			if (issueData.error) { d({ type: "JIRA_ERROR", error: issueData.error }); return; }
			d({ type: "JIRA_DONE", result: { key: issueData.key, exists: false, versionName: verData.name } });
		} catch (e) {
			d({ type: "JIRA_ERROR", error: e instanceof Error ? e.message : String(e) });
		}
	};

	const fp = filterByRelevance(s.projects.map((p) => ({ ...p, name: p.name, path: p.pathWithNamespace ?? "" })), s.projectSearch);
	const fb = filterByRelevance(s.branches.map((b) => ({ ...b, name: b.name })), s.branchSearch);
	const fj = filterByRelevance(s.jiraProjects.map((p) => ({ ...p, name: `${p.key} ${p.name ?? ""}` })), s.jiraProjectSearch);
	const jiraUrl = s.jiraResult && s.jiraHost ? `${s.jiraHost}/browse/${s.jiraResult.key}` : "";

	if (s.projectsLoading) return <div><style>{releaseStyle}</style><div class="loading-row"><span class="spinner" />{t("web.loadingProjects")}</div></div>;
	if (s.projectsError) return <div><style>{releaseStyle}</style><div class="state-error">{s.projectsError}</div></div>;

	return (
		<div>
			<style>{releaseStyle}</style>
			<div class="page-header"><h2>{t("web.releaseTitle")}</h2><p>{t("web.releaseDesc")}</p></div>

			{/* ── Project ── */}
			<div class="sel" data-sel="project" style={`z-index:${s.projectOpen ? 100 : 1}`}>
				<button class={`sel-trigger${s.projectOpen ? " open" : ""}`} type="button"
					role="combobox" aria-expanded={s.projectOpen} aria-haspopup="listbox"
					onClick={() => { d({ type: "SET_BRANCH_OPEN", open: false }); d({ type: "SET_JIRA_PROJECT_OPEN", open: false }); d({ type: "SET_PROJECT_OPEN", open: !s.projectOpen }); }}>
					<span class="sel-trigger-label">{t("web.projectLabel")}</span>
					<span class={`sel-trigger-value${s.selected ? "" : " empty"}`}>{s.selected ? s.selected.name : t("web.selectProject")}</span>
					<span class="sel-trigger-arrow">▼</span>
				</button>
				{s.projectOpen && (
					<div class="sel-dropdown" role="listbox" aria-label={t("web.selectProject")}>
						<div class="sel-search">
							<input ref={projectSearchRef} class="sel-search-input" type="text" placeholder={t("web.searchProjects")} value={s.projectSearch}
								onChange={(e: Event) => d({ type: "SET_PROJECT_SEARCH", search: (e.target as HTMLInputElement).value })}
								onKeyDown={(e: KeyboardEvent) => {
									const n = selKeyDown(e, s.projectOpen, fp.length, s.projectIndex,
										(i) => { const p = fp[i]; if (p) handleSelectProject(p as Project); },
										() => d({ type: "SET_PROJECT_OPEN", open: false }));
									if (n !== undefined) d({ type: "SET_PROJECT_INDEX", index: n });
								}} />
						</div>
						{fp.length > 0 ? fp.map((p, i) => (
							<div class={`sel-item${s.selected?.id === (p as Project).id ? " active" : ""}${i === s.projectIndex ? " highlighted" : ""}`}
								onMouseEnter={() => d({ type: "SET_PROJECT_INDEX", index: i })}
								onClick={() => handleSelectProject(p as Project)}>
								<div class="sel-item-name">{(p as Project).name}</div>
								<div class="sel-item-sub">{(p as Project).pathWithNamespace}</div>
							</div>
						)) : <div class="sel-empty">{t("web.noProjects")}</div>}
					</div>
				)}
			</div>

			{/* ── Branch ── */}
			{s.selected && (s.branchesLoading ? (
				<div class="loading-row"><span class="spinner" />{t("web.loadingBranches")}</div>
			) : s.branches.length > 0 && (
				<div class="sel" data-sel="branch" style={`z-index:${s.branchOpen ? 100 : 1}`}>
					<button class={`sel-trigger${s.branchOpen ? " open" : ""}`} type="button"
						role="combobox" aria-expanded={s.branchOpen} aria-haspopup="listbox"
						onClick={() => { d({ type: "SET_PROJECT_OPEN", open: false }); d({ type: "SET_JIRA_PROJECT_OPEN", open: false }); d({ type: "SET_BRANCH_OPEN", open: !s.branchOpen }); }}>
						<span class="sel-trigger-label">{t("web.branchLabel")}</span>
						<span class={`sel-trigger-value${s.selectedBranch ? "" : " empty"}`}>{s.selectedBranch || t("web.selectBranch")}</span>
						<span class="sel-trigger-arrow">▼</span>
					</button>
					{s.branchOpen && (
						<div class="sel-dropdown" role="listbox" aria-label={t("web.selectBranch")}>
							<div class="sel-search">
								<input ref={branchSearchRef} class="sel-search-input" type="text" placeholder={t("web.filterBranches")} value={s.branchSearch}
									onChange={(e: Event) => d({ type: "SET_BRANCH_SEARCH", search: (e.target as HTMLInputElement).value })}
									onKeyDown={(e: KeyboardEvent) => {
										const n = selKeyDown(e, s.branchOpen, fb.length, s.branchIndex,
											(i) => { const b = fb[i]; if (b) handleSelectBranch((b as Branch).name); },
											() => d({ type: "SET_BRANCH_OPEN", open: false }));
										if (n !== undefined) d({ type: "SET_BRANCH_INDEX", index: n });
									}} />
							</div>
							{fb.length > 0 ? fb.map((b, i) => (
								<div class={`sel-item${(b as Branch).name === s.selectedBranch ? " active" : ""}${i === s.branchIndex ? " highlighted" : ""}`}
									onMouseEnter={() => d({ type: "SET_BRANCH_INDEX", index: i })}
									onClick={() => handleSelectBranch((b as Branch).name)}>
									<span class="sel-item-name">{(b as Branch).name}</span>
									{(b as Branch).default && <span style="font-size:10px;color:var(--accent);margin-left:6px">{t("web.defaultBranch")}</span>}
								</div>
							)) : <div class="sel-empty">{t("web.noBranches")}</div>}
						</div>
					)}
				</div>
			))}

			{/* ── Version ── */}
			{s.selected && s.selectedBranch && !s.branchesLoading &&
				(s.pomLoading ? <div class="loading-row"><span class="spinner" />{t("web.loadingVersion")}</div>
				: s.pomError ? <div class="version-error">{s.pomError.includes("404") ? t("web.noPom") : s.pomError}</div>
				: s.pomInfo && <div class="version-display"><span class="version-tag">{t("web.versionTag")}</span><span class="version-number">{cleanVersion(s.pomInfo.version)}</span></div>)}

			{/* ── Jira ── */}
			{s.selected && s.pomInfo?.version && !s.pomLoading && (
				<div class="jira-section">
					{s.jiraProjectsLoading ? (
						<div class="loading-row"><span class="spinner" />{t("web.loadingJiraProjects")}</div>
					) : (
						<div class="sel" data-sel="jira" style={`z-index:${s.jiraProjectOpen ? 100 : 1}`}>
							<button class={`sel-trigger${s.jiraProjectOpen ? " open" : ""}`} type="button"
								role="combobox" aria-expanded={s.jiraProjectOpen} aria-haspopup="listbox"
								onClick={() => { d({ type: "SET_PROJECT_OPEN", open: false }); d({ type: "SET_BRANCH_OPEN", open: false }); d({ type: "SET_JIRA_PROJECT_OPEN", open: !s.jiraProjectOpen }); }}>
								<span class="sel-trigger-label">{t("web.jiraProjectLabel")}</span>
								<span class={`sel-trigger-value${s.selectedJiraProject ? "" : " empty"}`}>{s.selectedJiraProject ? `${s.selectedJiraProject.key} - ${s.selectedJiraProject.name ?? ""}` : t("web.selectJiraProject")}</span>
								<span class="sel-trigger-arrow">▼</span>
							</button>
							{s.jiraProjectOpen && (
								<div class="sel-dropdown" role="listbox" aria-label={t("web.selectJiraProject")}>
									<div class="sel-search">
										<input ref={jiraSearchRef} class="sel-search-input" type="text" placeholder={t("web.searchJiraProject")} value={s.jiraProjectSearch}
											onChange={(e: Event) => d({ type: "SET_JIRA_PROJECT_SEARCH", search: (e.target as HTMLInputElement).value })}
											onKeyDown={(e: KeyboardEvent) => {
												const n = selKeyDown(e, s.jiraProjectOpen, fj.length, s.jiraProjectIndex,
													(i) => { const p = fj[i]; if (p) d({ type: "SELECT_JIRA_PROJECT", project: p as JiraProject }); },
													() => d({ type: "SET_JIRA_PROJECT_OPEN", open: false }));
												if (n !== undefined) d({ type: "SET_JIRA_PROJECT_INDEX", index: n });
											}} />
									</div>
									{fj.length > 0 ? fj.map((p, i) => (
										<div class={`sel-item${s.selectedJiraProject?.key === (p as JiraProject).key ? " active" : ""}${i === s.jiraProjectIndex ? " highlighted" : ""}`}
											onMouseEnter={() => d({ type: "SET_JIRA_PROJECT_INDEX", index: i })}
											onClick={() => d({ type: "SELECT_JIRA_PROJECT", project: p as JiraProject })}>
											<span class="sel-item-name">{(p as JiraProject).key}</span>
											{(p as JiraProject).name && <div class="sel-item-sub">{(p as JiraProject).name}</div>}
										</div>
									)) : <div class="sel-empty">{t("web.noJiraProjects")}</div>}
								</div>
							)}
						</div>
					)}

					<button class="jira-btn" type="button"
						disabled={!s.selectedJiraProject || s.jiraStatus === "checking" || s.jiraStatus === "creating"}
						onClick={handleCreateIssue}>
						{s.jiraStatus === "checking" ? t("web.checkingBtn") : s.jiraStatus === "creating" ? t("web.creatingBtn") : t("web.createBtn")}
					</button>

					{(s.jiraStatus === "checking" || s.jiraStatus === "creating") && (
						<div class="loading-row" style="margin-top:12px"><span class="spinner" />
							{s.jiraStatus === "checking" ? t("web.checkingIssues") : t("web.creatingIssue")}
						</div>
					)}

					{s.jiraResult && (
						<div class="jira-result">
							<div class="jira-result-label">
								{s.jiraResult.exists ? t("web.versionExistsResult", { version: s.jiraResult.versionName }) : t("web.versionCreatedResult", { version: s.jiraResult.versionName })}
							</div>
							<a class="jira-result-key" href={jiraUrl} target="_blank" rel="noreferrer">{s.jiraResult.key}</a>
							<span class={`jira-result-badge ${s.jiraResult.exists ? "exists" : "created"}`}>
								{s.jiraResult.exists ? t("web.existsBadge") : t("web.createdBadge")}
							</span>
						</div>
					)}
					{s.jiraError && <div class="jira-error" role="alert">{s.jiraError}</div>}
				</div>
			)}

			{!s.selected && <div class="empty-hint">{t("web.emptyHint")}</div>}
		</div>
	);
};

export const mount = (el: HTMLElement) => { render(<ReleaseClient />, el); };