import { type FC, useEffect, useReducer } from "hono/jsx";
import { render } from "hono/jsx/dom";
import {
	commonCss,
	fieldLabel,
	LoadingRow,
	PageHeader,
	pageHeaderCss,
	sectionTitle,
} from "../../shared/components/common";
import { Modal, modalCss } from "../../shared/components/modal";
import { Badge } from "../../shared/components/neonblade/badge";
import { BorderBeamCornerCutCard } from "../../shared/components/neonblade/border-beam-corner-cut-card";
import { CornerCutButton } from "../../shared/components/neonblade/corner-cut-button";
import { GlitchText } from "../../shared/components/neonblade/glitch-text";
import { NeonGlow } from "../../shared/components/neonblade/neon-glow";
import { NeonGlowCornerCutCard } from "../../shared/components/neonblade/neon-glow-corner-cut-card";
import { NeonSelect } from "../../shared/components/neonblade/neon-select";
import { initPromise, t } from "../../shared/i18n";
import { cleanVersion } from "../../utils/pom";

const ACCENT = "#00f3ff";
const ERROR_COLOR = "#ff4444";

// ── Styles ──

const releaseStyle = `${commonCss}${pageHeaderCss}${modalCss}
  /* ── Theme: cyan accent overrides ── */
  .spinner { border-top-color: ${ACCENT}; }
  .result-card { border-color: rgba(0,243,255,0.08); }
  .result-success { border-color: rgba(0,243,255,0.18); }
  .result-key { color: ${ACCENT}; border-bottom-color: rgba(0,243,255,0.3); }
  .result-key:hover { border-bottom-color: ${ACCENT}; }
  .result-text.success { color: ${ACCENT}; }

  /* ── Version display (inside NeonGlowCornerCutCard) ── */
  .version-tag { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.05em; font-family: var(--mono); }
  .version-number { font-size: 20px; font-weight: 600; font-family: var(--mono); letter-spacing: -0.01em; }
  .version-display-card { height: auto !important; margin-bottom: 16px; }
  .version-display-card .ngcc-card { height: auto !important; padding: 12px 16px; }

  .empty-hint { text-align: center; padding: 32px 0; font-size: 13px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both; }
  .error-text { color: ${ERROR_COLOR}; font-size: 13px; margin-top: 12px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* ── Custom Checkbox ── */
  input[type="checkbox"] {
    appearance: none;
    width: 16px;
    height: 16px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg-input);
    cursor: pointer;
    position: relative;
    transition: border-color 0.15s, background 0.15s;
  }
  input[type="checkbox"]:checked {
    background: ${ACCENT};
    border-color: ${ACCENT};
  }
  input[type="checkbox"]:checked::after {
    content: "✓";
    position: absolute;
    top: -1px;
    left: 2px;
    font-size: 12px;
    font-weight: 700;
    color: var(--bg-void);
  }
  input[type="checkbox"]:focus-visible {
    outline: 2px solid color-mix(in srgb, ${ACCENT} 40%, transparent);
    outline-offset: 2px;
  }

  .jira-result-key {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    color: ${ACCENT};
    text-decoration: none;
    border-bottom: 1px dashed ${ACCENT}4d;
    transition: border-color 0.2s;
  }
  .jira-result-key:hover { border-bottom-color: ${ACCENT}; }
  .jira-result-label { font-size: 11px; color: var(--text-3); margin-bottom: 4px; }
  .jira-result-card { margin-top: 16px; height: auto !important; }
  .jira-result-card .ngcc-card { padding: 12px 16px; height: auto !important; display: flex; flex-direction: column; gap: 8px; }
  .jira-result-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  /* ── History (items rendered as BorderBeamCornerCutCard) ── */
  .history-item-card { margin-bottom: 0; }
  .history-item-card .bbc-inner { padding: 12px 16px; }
  .history-section {
    margin-bottom: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
  }
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .history-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .history-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }
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
  .history-result-key {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    color: ${ACCENT};
    text-decoration: none;
  }
  .history-result {
    margin-top: 12px;
    padding: 10px 14px;
    background: var(--bg-void);
    border: 1px solid ${ACCENT}14;
    border-radius: 8px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* ── Step indicator (Badge-based) ── */
  .release-steps { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both; }
  .release-step-sep { display: inline-flex; align-items: center; color: ${ACCENT}; opacity: 0.6; font-size: 14px; }
`;

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
	artifactId: string | null;
};
type JiraProject = { key: string; id: string; name?: string };

// ── State ──

type State = {
	jiraHost: string;
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
	jiraProjects: JiraProject[];
	jiraProjectsLoading: boolean;
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
	selected: null,
	branches: [],
	branchesLoading: false,
	selectedBranch: "",
	pomInfo: null,
	pomLoading: false,
	pomError: "",
	jiraProjects: [],
	jiraProjectsLoading: false,
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
	| { type: "SELECT_PROJECT"; project: Project }
	| { type: "CLEAR_PROJECT" }
	| { type: "BRANCHES_LOADING" }
	| { type: "BRANCHES_LOADED"; branches: Branch[] }
	| { type: "SELECT_BRANCH"; branch: string }
	| { type: "POM_LOADING" }
	| { type: "POM_LOADED"; info: PomInfo }
	| { type: "POM_ERROR"; error: string }
	| { type: "JIRA_PROJECTS_LOADING" }
	| { type: "JIRA_PROJECTS_LOADED"; projects: JiraProject[] }
	| { type: "JIRA_PROJECTS_ERROR"; error: string }
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
	| { type: "MR_CREATING" }
	| {
			type: "MR_DONE";
			mrUrl: string;
			mrSourceBranch: string;
			mrTargetBranch: string;
	  }
	| { type: "MR_ERROR"; error: string };

const reducer = (state: State, action: Action): State => {
	switch (action.type) {
		case "SET_JIRA_HOST":
			return { ...state, jiraHost: action.host };
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
				jiraProjectsLoading: false,
				jiraProjects: [],
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
		case "SELECT_BRANCH":
			return {
				...state,
				selectedBranch: action.branch,
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
		case "SELECT_JIRA_PROJECT":
			return {
				...state,
				selectedJiraProject: action.project,
				jiraStatus: "idle",
				jiraResult: null,
				jiraError: "",
			};
		case "CLEAR_JIRA_PROJECT":
			return {
				...state,
				selectedJiraProject: null,
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
			return {
				...state,
				history: [],
				clearConfirm: false,
				quickResults: {},
				quickErrors: {},
			};
		case "TOGGLE_CREATE_MR":
			return {
				...state,
				createMrChecked: {
					...state.createMrChecked,
					[action.id]: !state.createMrChecked[action.id],
				},
			};
		case "MR_SELECTING":
			return {
				...state,
				mrStatus: "selecting",
				mrBranches: action.branches,
				mrSourceBranch: "",
				mrTargetBranch: "",
				mrError: "",
			};
		case "MR_SOURCE_SELECTED":
			return {
				...state,
				mrSourceBranch: action.branch,
			};
		case "MR_LOADING":
			return {
				...state,
				mrStatus: "loading",
				mrBranches: [],
				mrSourceBranch: "",
				mrTargetBranch: "",
				mrError: "",
			};
		case "MR_CREATING":
			return {
				...state,
				mrStatus: "creating",
				mrUrl: "",
				mrTargetBranch: "",
				mrError: "",
			};
		case "MR_DONE":
			return {
				...state,
				mrStatus: "done",
				mrUrl: action.mrUrl,
				mrSourceBranch: action.mrSourceBranch,
				mrTargetBranch: action.mrTargetBranch,
				history: state.history.map((e) =>
					e.projectId === state.selected?.id &&
					e.branch === state.selectedBranch
						? {
								...e,
								mrUrl: action.mrUrl,
								mrSourceBranch: action.mrSourceBranch,
								mrTargetBranch: action.mrTargetBranch,
							}
						: e,
				),
			};
		case "MR_ERROR":
			return { ...state, mrStatus: "error", mrError: action.error };
		default:
			return state;
	}
};

// ── Helpers ──

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
		try {
			const res = await fetch("/release/api/history", { method: "DELETE" });
			if (res.ok) d({ type: "CLEAR_HISTORY_DONE" });
		} catch {
			/* delete failed, keep local state */
		}
	};

	return (
		<div class="history-section">
			<div style="margin-bottom:12px">
				{sectionTitle(ACCENT, t("web.historyTitle"))}
			</div>
			{s.history.length > 0 ? (
				<div class="history-list">
					{s.history.map((entry) => (
						<BorderBeamCornerCutCard
							key={entry.id}
							className="history-item-card"
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
										<span class="history-project">{entry.projectName}</span>
									</NeonGlow>
									<span class="history-detail">
										{entry.branch} / {entry.jiraProjectKey}
									</span>
									{entry.mrUrl && (
										<NeonGlow colors={ACCENT} glowIntensity="subtle">
											<span style="font-size:12px;margin-left:6px">
												{t("release.mrFromTo", {
													source: entry.mrSourceBranch ?? "",
													target: entry.mrTargetBranch ?? entry.branch,
												})}
											</span>
										</NeonGlow>
									)}
								</div>
								<div class="history-actions">
									{entry.mrUrl && (
										<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
											<input
												type="checkbox"
												checked={s.createMrChecked[entry.id] ?? false}
												onChange={() =>
													d({ type: "TOGGLE_CREATE_MR", id: entry.id })
												}
											/>
											{fieldLabel(ACCENT, t("web.createMrCheckbox"))}
										</label>
									)}
									<CornerCutButton
										color={ACCENT}
										variant={
											s.quickExecuting === entry.id ? "outline" : "solid"
										}
										size="xs"
										disabled={s.quickExecuting !== null}
										onClick={() => handleQuickExecute(entry.id)}
									>
										{s.quickExecuting === entry.id
											? t("web.executing")
											: t("web.quickExecute")}
									</CornerCutButton>
								</div>
							</div>
							{(() => {
								const qr = s.quickResults[entry.id];
								if (!qr) return null;
								return (
									<div class="history-result">
										<a
											class="history-result-key"
											href={qr.issueUrl}
											target="_blank"
											rel="noreferrer"
										>
											{qr.issueKey}
										</a>
										<Badge
											color={ACCENT}
											variant={qr.issueCreated ? "solid" : "outline"}
											shape="pill"
											dot="pulse"
											size="xs"
											glow={qr.issueCreated}
										>
											{qr.issueCreated
												? t("web.createdBadge")
												: t("web.existsBadge")}
										</Badge>
										<NeonGlow colors={ACCENT} glowIntensity="subtle">
											<span style="font-size:12px;margin-left:8px">
												v{qr.version}
											</span>
										</NeonGlow>
										{qr.versionCreated && (
											<Badge
												color={ACCENT}
												variant="solid"
												shape="pill"
												size="xs"
												glow
											>
												{t("web.createdBadge")}
											</Badge>
										)}
										{qr.mrUrl && (
											<span style="font-size:12px;margin-left:12px">
												<a
													href={qr.mrUrl}
													target="_blank"
													rel="noreferrer"
													style={`color:${ACCENT};text-decoration:none;border-bottom:1px dashed ${ACCENT}`}
												>
													{t("release.mrFromTo", {
														source: qr.mrSourceBranch ?? "",
														target: qr.mrTargetBranch ?? entry.branch,
													})}
												</a>
											</span>
										)}
									</div>
								);
							})()}
							{s.quickErrors[entry.id] && (
								<div class="error-text" role="alert">
									<NeonGlow colors={ERROR_COLOR} glowIntensity="subtle">
										{s.quickErrors[entry.id]}
									</NeonGlow>
								</div>
							)}
						</BorderBeamCornerCutCard>
					))}
				</div>
			) : (
				<div class="empty-hint">
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.noHistory")}
					</NeonGlow>
				</div>
			)}
			<div class="history-footer">
				<CornerCutButton
					color={ACCENT}
					size="sm"
					variant="solid"
					onClick={() => d({ type: "SHOW_NEW_MODAL" })}
				>
					{t("web.createNew")}
				</CornerCutButton>
				{s.history.length > 0 &&
					(s.clearConfirm ? (
						<div style="display:flex;align-items:center;gap:8px">
							<NeonGlow colors={ACCENT} glowIntensity="subtle">
								<span style="font-size:12px">{t("web.clearConfirm")}</span>
							</NeonGlow>
							<CornerCutButton
								color={ACCENT}
								variant="ghost"
								size="xs"
								onClick={handleClearHistory}
							>
								{t("web.clearHistory")}
							</CornerCutButton>
							<CornerCutButton
								color={ACCENT}
								variant="ghost"
								size="xs"
								onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
							>
								{t("web.cancel")}
							</CornerCutButton>
						</div>
					) : (
						<CornerCutButton
							color={ACCENT}
							variant="ghost"
							size="xs"
							onClick={() => d({ type: "CLEAR_CONFIRM_TOGGLE" })}
						>
							{t("web.clearHistory")}
						</CornerCutButton>
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

	// Auto-create MR after branch is selected
	useEffect(() => {
		if (s.mrStatus !== "creating" || !s.mrSourceBranch || !s.selected) return;
		const jiraUrl2 =
			s.jiraResult && s.jiraHost
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
					d({
						type: "MR_DONE",
						mrUrl: data.mrUrl,
						mrSourceBranch: data.sourceBranch,
						mrTargetBranch: data.targetBranch,
					});
					fetch("/release/api/history")
						.then((r) => r.json())
						.then((h) => d({ type: "SET_HISTORY", history: h }));
				} else d({ type: "MR_ERROR", error: data.error ?? "Failed" });
			})
			.catch((e) =>
				d({
					type: "MR_ERROR",
					error: e instanceof Error ? e.message : "Failed",
				}),
			);
	}, [
		s.mrStatus,
		s.mrSourceBranch,
		s.selected?.id,
		s.selectedBranch,
		s.jiraResult?.key,
		s.jiraHost,
	]);

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
		const flowPilotName =
			s.pomInfo.flowPilotName ?? s.pomInfo.artifactId ?? s.selected.name;
		const projectVersion = cleanVersion(s.pomInfo.version);
		const versionName = `${flowPilotName}-${projectVersion}`;
		const summary = `${flowPilotName}-${projectVersion} ${t("web.releaseSuffix") ?? t("release.releaseSuffix")}`;
		const safeSummary = summary.replace(/"/g, '\\"');

		d({ type: "JIRA_CHECKING" });
		try {
			const searchRes = await fetch("/release/api/jira/search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jql: `summary ~ "${safeSummary}" AND project = ${s.selectedJiraProject.key}`,
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
				// Save to history (non-critical)
				try {
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
				} catch {
					/* history save failed, non-critical */
				}
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
			// Save to history (non-critical)
			try {
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
			} catch {
				/* history save failed, non-critical */
			}
		} catch (e) {
			d({
				type: "JIRA_ERROR",
				error: e instanceof Error ? e.message : String(e),
			});
		}
	};

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
		return <LoadingRow color={ACCENT} text={t("web.loadingProjects")} />;
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
			{/* ── Pipeline ── */}
			<div class="release-steps">
				<Badge
					color={ACCENT}
					variant={step1Done ? "solid" : step1Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step1Done || step1Active}
				>
					{t("web.projectLabel")}
				</Badge>
				<span class="release-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={step2Done ? "solid" : step2Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step2Done || step2Active}
				>
					{t("web.branchLabel")}
				</Badge>
				<span class="release-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={step3Done ? "solid" : step3Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step3Done || step3Active}
				>
					{t("web.versionTag")}
				</Badge>
				<span class="release-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={step4Done ? "solid" : step4Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step4Done || step4Active}
				>
					{t("web.jiraProjectLabel")}
				</Badge>
				<span class="release-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={step5Done ? "solid" : step5Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step5Done || step5Active}
				>
					{t("web.createBtn")}
				</Badge>
			</div>

			{/* ── Project ── */}
			<NeonSelect
				color={ACCENT}
				id="project"
				label={t("web.projectLabel")}
				placeholder={t("web.selectProject")}
				items={s.projects.map((p) => ({
					...p,
					name: p.name,
					path: p.pathWithNamespace ?? "",
				}))}
				value={s.selected}
				isEqual={(a, b) => a.id === b.id}
				onSelect={(p) => handleSelectProject(p as Project)}
				renderItem={(item, _isActive) => (
					<span>
						<div class={`sel-item-name`}>{(item as Project).name}</div>
						{(item as Project).pathWithNamespace && (
							<div class="sel-item-sub">
								{(item as Project).pathWithNamespace}
							</div>
						)}
					</span>
				)}
				searchPlaceholder={t("web.searchProjects")}
				emptyText={t("web.noProjects")}
			/>

			{/* ── Branch ── */}
			{s.selected && (s.branchesLoading || s.branches.length > 0) && (
				<NeonSelect
					color={ACCENT}
					id="branch"
					label={t("web.branchLabel")}
					placeholder={t("web.selectBranch")}
					loading={s.branchesLoading}
					items={s.branches.map((b) => ({ ...b, name: b.name }))}
					value={s.selectedBranch ? { name: s.selectedBranch } : undefined}
					isEqual={(a, b) => a.name === b.name}
					onSelect={(item) => handleSelectBranch(item.name)}
					renderItem={(item, _isActive) => (
						<span>
							<span class={`sel-item-name`}>{(item as Branch).name}</span>
							{(item as Branch).default && (
								<Badge color={ACCENT} variant="outline" shape="pill" size="xs">
									{t("web.defaultBranch")}
								</Badge>
							)}
						</span>
					)}
					searchPlaceholder={t("web.filterBranches")}
					emptyText={t("web.noBranches")}
				/>
			)}

			{/* ── Version ── */}
			{s.selected &&
				s.selectedBranch &&
				!s.branchesLoading &&
				(s.pomLoading ? (
					<LoadingRow color={ACCENT} text={t("web.loadingVersion")} />
				) : s.pomError ? (
					<div class="error-text" role="alert">
						<NeonGlow colors={ERROR_COLOR} glowIntensity="subtle">
							{s.pomError.includes("404") ? t("web.noPom") : s.pomError}
						</NeonGlow>
					</div>
				) : (
					s.pomInfo && (
						<NeonGlowCornerCutCard
							className="version-display-card"
							colorA={ACCENT}
							size="sm"
							hoverEffect="glow-only"
						>
							<div style="display:flex;align-items:center;gap:12px">
								<span class="version-tag">{t("web.versionTag")}</span>
								<NeonGlow colors={ACCENT} glowIntensity="subtle">
									<span class="version-number">
										{cleanVersion(s.pomInfo.version)}
									</span>
								</NeonGlow>
							</div>
						</NeonGlowCornerCutCard>
					)
				))}

			{/* ── Jira ── */}
			{s.selected && s.pomInfo?.version && !s.pomLoading && (
				<div>
					<NeonSelect
						color={ACCENT}
						id="jira-project"
						label={t("web.jiraProjectLabel")}
						placeholder={t("web.selectJiraProject")}
						loading={s.jiraProjectsLoading}
						items={s.jiraProjects.map((p) => ({
							...p,
							name: `${p.key} ${p.name ?? ""}`,
						}))}
						value={
							s.selectedJiraProject
								? {
										...s.selectedJiraProject,
										name: `${s.selectedJiraProject.key} ${s.selectedJiraProject.name ?? ""}`,
									}
								: null
						}
						isEqual={(a, b) =>
							(a as JiraProject).key === (b as JiraProject).key
						}
						onSelect={(item) =>
							d({
								type: "SELECT_JIRA_PROJECT",
								project: item as JiraProject,
							})
						}
						renderItem={(item, _isActive) => (
							<span>
								<span class={`sel-item-name`}>{(item as JiraProject).key}</span>
								{(item as JiraProject).name && (
									<div class="sel-item-sub">{(item as JiraProject).name}</div>
								)}
							</span>
						)}
						renderValue={(item) =>
							`${(item as JiraProject).key} - ${(item as JiraProject).name ?? ""}`
						}
						searchPlaceholder={t("web.searchJiraProject")}
						emptyText={t("web.noJiraProjects")}
					/>

					<CornerCutButton
						color={ACCENT}
						variant="solid"
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
					</CornerCutButton>

					{(s.jiraStatus === "checking" || s.jiraStatus === "creating") && (
						<div style="margin-top:12px">
							<LoadingRow
								color={ACCENT}
								text={
									s.jiraStatus === "checking"
										? t("web.checkingIssues")
										: t("web.creatingIssue")
								}
							/>
						</div>
					)}

					{s.jiraResult && (
						<NeonGlowCornerCutCard
							className="jira-result-card"
							colorA={ACCENT}
							size="sm"
							hoverEffect="glow-only"
						>
							<div class="jira-result-label">
								{s.jiraResult.exists
									? t("web.versionExistsResult", {
											version: s.jiraResult.versionName,
										})
									: t("web.versionCreatedResult", {
											version: s.jiraResult.versionName,
										})}
							</div>
							<div class="jira-result-row">
								<a
									class="jira-result-key"
									href={jiraUrl}
									target="_blank"
									rel="noreferrer"
								>
									{s.jiraResult.key}
								</a>
								<Badge
									color={ACCENT}
									variant={s.jiraResult.exists ? "outline" : "solid"}
									shape="pill"
									size="xs"
									glow={!s.jiraResult.exists}
								>
									{s.jiraResult.exists
										? t("web.existsBadge")
										: t("web.createdBadge")}
								</Badge>
							</div>
						</NeonGlowCornerCutCard>
					)}
					{s.jiraError && (
						<div class="error-text" role="alert">
							<NeonGlow colors={ERROR_COLOR} glowIntensity="subtle">
								{s.jiraError}
							</NeonGlow>
						</div>
					)}
					{s.jiraResult &&
						(s.mrStatus === "idle" || s.mrStatus === "loading") && (
							<CornerCutButton
								color={ACCENT}
								variant="solid"
								disabled={s.mrStatus === "loading"}
								onClick={async () => {
									if (s.mrStatus === "loading") return;
									d({ type: "MR_LOADING" });
									try {
										const res = await fetch(
											`/release/api/projects/${s.selected?.id}/branches`,
										);
										const data = await res.json();
										const branches = (Array.isArray(data) ? data : []).filter(
											(b: { name: string }) => b.name !== s.selectedBranch,
										);
										if (branches.length === 0) {
											d({
												type: "MR_ERROR",
												error: t("release.noSourceBranches"),
											});
											return;
										}
										d({ type: "MR_SELECTING", branches });
									} catch (e) {
										d({
											type: "MR_ERROR",
											error: e instanceof Error ? e.message : "Failed",
										});
									}
								}}
							>
								{s.mrStatus === "loading" ? (
									<>
										<span
											class="spinner"
											style="width:12px;height:12px;border-width:1px;margin-right:6px;vertical-align:middle"
										/>
										{t("web.loadingMr")}
									</>
								) : (
									t("web.createMrBtn")
								)}
							</CornerCutButton>
						)}
					{s.mrStatus === "selecting" && (
						<div style="margin-top:12px">
							<div style="margin-bottom:4px">
								<NeonGlow colors={ACCENT} glowIntensity="subtle">
									<span style="font-size:13px">
										{t("release.selectMrBranch")}
									</span>
								</NeonGlow>
							</div>
							<NeonSelect
								color={ACCENT}
								id="mr-branch"
								label={t("web.branchLabel")}
								placeholder={t("web.selectBranch")}
								items={s.mrBranches}
								value={
									s.mrSourceBranch ? { name: s.mrSourceBranch } : undefined
								}
								isEqual={(a, b) => a.name === b.name}
								onSelect={(item) =>
									d({ type: "MR_SOURCE_SELECTED", branch: item.name })
								}
								renderItem={(item, _isActive) => (
									<span>
										<span class={`sel-item-name`}>{item.name}</span>
										{(item as Branch).default && (
											<Badge
												color={ACCENT}
												variant="outline"
												shape="pill"
												size="xs"
											>
												{t("web.defaultBranch")}
											</Badge>
										)}
									</span>
								)}
								searchPlaceholder={t("web.filterBranches")}
								emptyText={t("web.noBranches")}
								zIndex={100}
							/>
						</div>
					)}
					{s.mrStatus === "selecting" && s.mrSourceBranch && (
						<div style="margin-top:8px">
							<div style="margin-bottom:6px">
								<NeonGlow colors={ACCENT} glowIntensity="subtle">
									<span style="font-size:13px">
										{t("release.mrFromTo", {
											source: s.mrSourceBranch,
											target: s.selectedBranch,
										})}
									</span>
								</NeonGlow>
							</div>
							<CornerCutButton
								color={ACCENT}
								variant="solid"
								onClick={() => d({ type: "MR_CREATING" })}
							>
								{t("release.confirmCreateMr")}
							</CornerCutButton>
						</div>
					)}
					{s.mrStatus === "creating" && (
						<div style="margin-top:12px">
							<LoadingRow color={ACCENT} text={t("release.creatingMrBtn")} />
						</div>
					)}
					{s.mrStatus === "done" && s.mrUrl && (
						<NeonGlowCornerCutCard
							className="jira-result-card"
							colorA={ACCENT}
							size="sm"
							hoverEffect="glow-only"
						>
							<div class="jira-result-label">MR</div>
							<a
								class="jira-result-key"
								href={s.mrUrl}
								target="_blank"
								rel="noreferrer"
							>
								{t("release.mrFromTo", {
									source: s.mrSourceBranch,
									target: s.selectedBranch,
								})}
							</a>
						</NeonGlowCornerCutCard>
					)}
					{s.mrStatus === "error" && s.mrError && (
						<div class="error-text" role="alert" style="margin-top:12px">
							<NeonGlow colors={ERROR_COLOR} glowIntensity="subtle">
								{s.mrError}
							</NeonGlow>
						</div>
					)}
				</div>
			)}

			{!s.selected && (
				<div class="empty-hint">
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.emptyHint")}
					</NeonGlow>
				</div>
			)}
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
			<PageHeader
				title={
					<GlitchText
						neon
						mode="active"
						colorA={ACCENT}
						colorB={ACCENT}
						glowColor={ACCENT}
						speed="slow"
						style="color:#00f3ff"
					>
						{t("web.releaseTitle")}
					</GlitchText>
				}
				description={
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.releaseDesc")}
					</NeonGlow>
				}
			/>

			{s.historyLoading ? (
				<LoadingRow color={ACCENT} text={t("web.loading")} />
			) : s.showNewModal ? (
				<Modal
					open={s.showNewModal}
					onClose={() => {
						fetch("/release/api/history")
							.then((r) => r.json())
							.then((data) => {
								d({
									type: "SET_HISTORY",
									history: Array.isArray(data) ? data : [],
								});
								d({ type: "HIDE_NEW_MODAL" });
							})
							.catch(() => d({ type: "HIDE_NEW_MODAL" }));
					}}
					title={t("web.newModalTitle")}
				>
					<ReleaseFlow s={s} d={d} />
				</Modal>
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
