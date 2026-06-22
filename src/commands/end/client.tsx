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
import {
	pipelineCss,
	pipelineLineClass,
	pipelineStepClass,
} from "../../shared/components/pipeline";
import {
	Select,
	selectCss,
	useClickOutside,
	useDropdown,
} from "../../shared/components/select";
import { initPromise, t } from "../../shared/i18n";

// ── Styles ──

const endStyle = `${pipelineCss}${selectCss}${commonCss}${pageHeaderCss}
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
	// Step 6: Jira
	jiraHost: string;
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
	loading: true,
	error: "",
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
	jiraHost: "",
	jiraStatus: {},
	jiraTransitions: {},
	jiraErrors: {},
	jiraResults: {},
};

type Action =
	| { type: "SET_CWD_INPUT"; value: string }
	| { type: "SET_CWD"; cwd: string }
	| { type: "CWD_ERROR"; error: string }
	| {
			type: "LOADED";
			data: {
				currentBranch: string;
				localBranches: string[];
				detectedSource: string;
			};
	  }
	| { type: "LOAD_ERROR"; error: string }
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
	| { type: "SET_LOADING" }
	| { type: "JIRA_LOADING"; key: string }
	| { type: "JIRA_TRANSITIONS_LOADED"; key: string; transitions: Transition[] }
	| { type: "JIRA_TRANSITION_SUCCESS"; key: string; name: string }
	| { type: "JIRA_TRANSITION_ERROR"; key: string; error: string }
	| { type: "RESET" }
	| { type: "SET_JIRA_HOST"; host: string };

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
				currentBranch: action.data.currentBranch,
				localBranches: action.data.localBranches,
				detectedSource: action.data.detectedSource ?? "",
				loading: false,
				targetBranch: action.data.detectedSource || "",
			};
		case "LOAD_ERROR":
			return { ...state, loading: false, error: action.error };
		case "SELECT_TARGET_BRANCH":
			return { ...state, targetBranch: action.branch };
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
		case "SET_LOADING":
			return { ...state, loading: true };
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
		case "SET_JIRA_HOST":
			return { ...state, jiraHost: action.host };
	}
	return state;
};

// ── Helpers ──

const cwdParam = (cwd: string) =>
	cwd ? `&cwd=${encodeURIComponent(cwd)}` : "";

const cwdBody = (cwd: string) => (cwd ? { cwd } : {});

// ── Client Component ──

const EndClient: FC = () => {
	const [s, d] = useReducer(reducer, initial);
	const branchDd = useDropdown();
	useClickOutside([branchDd], ["branch"]);

	// Detect cwd from URL query param (set by CLI -o)
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const cwdFromQuery = params.get("cwd");
		if (cwdFromQuery) {
			d({ type: "SET_CWD", cwd: cwdFromQuery });
			d({ type: "SET_CWD_INPUT", value: cwdFromQuery });
		}
	}, []);

	// Fetch config (jiraHost)
	useEffect(() => {
		fetch("/end/api/config")
			.then((r) => r.json())
			.then((data) => {
				if (data.jiraHost) d({ type: "SET_JIRA_HOST", host: data.jiraHost });
			})
			.catch(() => {});
	}, []);

	// Load git status when cwd is set
	useEffect(() => {
		if (!s.cwd) return;
		d({ type: "SET_LOADING" });
		fetch(`/end/api/git/status?cwd=${encodeURIComponent(s.cwd)}`)
			.then((r) => r.json())
			.then((data) => {
				if (data.error) d({ type: "LOAD_ERROR", error: data.error });
				else d({ type: "LOADED", data });
			})
			.catch((e) =>
				d({
					type: "LOAD_ERROR",
					error: e instanceof Error ? e.message : String(e),
				}),
			);
	}, [s.cwd]);

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
			d({
				type: "CWD_ERROR",
				error: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const doRebase = async () => {
		d({ type: "REBASE_RUNNING" });
		try {
			const res = await fetch("/end/api/rebase", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					targetBranch: s.targetBranch,
					...cwdBody(s.cwd),
				}),
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
			d({
				type: "REBASE_ERROR",
				error: e instanceof Error ? e.message : String(e),
			});
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
				d({ type: "TICKETS_LOADING" });
				const ticketRes = await fetch(
					`/end/api/commits?base=${encodeURIComponent(s.targetBranch)}${cwdParam(s.cwd)}`,
				);
				const ticketData = await ticketRes.json();
				if (ticketData.error) {
					d({ type: "TICKETS_ERROR", error: ticketData.error });
				} else {
					d({ type: "TICKETS_LOADED", keys: ticketData.ticketKeys || [] });
					for (const key of ticketData.ticketKeys || []) {
						d({ type: "JIRA_LOADING", key });
						try {
							const transRes = await fetch(
								`/end/api/jira/transitions?key=${encodeURIComponent(key)}`,
							);
							const transData = await transRes.json();
							if (transData.error) {
								d({
									type: "JIRA_TRANSITION_ERROR",
									key,
									error: transData.error,
								});
							} else if (transData.transitions) {
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
			d({
				type: "PUSH_ERROR",
				error: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const doCreateMR = async () => {
		d({ type: "MR_RUNNING" });
		try {
			const res = await fetch("/end/api/create-mr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sourceBranch: s.currentBranch,
					targetBranch: s.targetBranch,
					title: `${s.currentBranch} -> ${s.targetBranch}`,
					ticketKeys: s.ticketKeys,
					...cwdBody(s.cwd),
				}),
			});
			const data = await res.json();
			if (data.error) {
				d({ type: "MR_ERROR", error: data.error });
			} else {
				d({ type: "MR_SUCCESS", url: data.url });
				if (data.url) {
					for (const key of s.ticketKeys) {
						try {
							await fetch("/end/api/jira/comment", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									key,
									comment: t("web.mrJiraCommentTemplate", {
										key,
										mrUrl: data.url,
									}),
								}),
							});
						} catch {
							/* non-critical */
						}
					}
				}
			}
		} catch (e) {
			d({
				type: "MR_ERROR",
				error: e instanceof Error ? e.message : String(e),
			});
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
				d({
					type: "JIRA_TRANSITION_SUCCESS",
					key,
					name: trans?.name ?? "Done",
				});
			}
		} catch (e) {
			d({
				type: "JIRA_TRANSITION_ERROR",
				key,
				error: e instanceof Error ? e.message : String(e),
			});
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
	const step6Done =
		s.ticketKeys.length > 0 &&
		s.ticketKeys.every((k) => s.jiraStatus[k] === "success");
	const step6Active = step5Done && !step6Done && s.ticketKeys.length > 0;
	const allDone = s.cwd && step2Done && step3Done && step5Done;

	// ── Render ──

	// No cwd: show path input
	if (!s.cwd) {
		return (
			<div>
				<style>{endStyle}</style>
				<PageHeader title={t("web.endTitle")} description={t("web.endDesc")} />
				<div class="cwd-section">
					<div class="cwd-row">
						<input
							class="cwd-input"
							type="text"
							placeholder={t("end.enterPath")}
							value={s.cwdInput}
							onInput={(e: Event) =>
								d({
									type: "SET_CWD_INPUT",
									value: (e.target as HTMLInputElement).value,
								})
							}
							onKeyDown={(e: KeyboardEvent) => {
								if (e.key === "Enter") setCwd();
							}}
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
				<LoadingRow text={t("web.loading")} />
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
				<ResultCard variant="error">
					<ResultText variant="error">{s.error}</ResultText>
				</ResultCard>
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

	const branchItems = s.localBranches.map((b) => ({ name: b }));

	return (
		<div>
			<style>{endStyle}</style>
			<PageHeader title={t("web.endTitle")} description={t("web.endDesc")} />

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

			<Select
				id="branch"
				label={t("end.targetBranch")}
				placeholder={t("end.selectBranch")}
				items={branchItems}
				value={s.targetBranch ? { name: s.targetBranch } : null}
				dropdown={branchDd}
				onSelect={(item) =>
					d({ type: "SELECT_TARGET_BRANCH", branch: item.name })
				}
				renderValue={(item) =>
					s.detectedSource && item.name === s.detectedSource
						? `${item.name} (${t("end.detectedSource")})`
						: item.name
				}
			/>

			{/* ── Step 2: Rebase ── */}
			{s.rebaseStatus === "idle" && s.targetBranch && (
				<button class="action-btn" type="button" onClick={doRebase}>
					{t("end.rebaseBtn")} → {s.targetBranch}
				</button>
			)}
			{s.rebaseStatus === "running" && (
				<LoadingRow text={`${t("end.rebasing")} ${s.targetBranch}...`} />
			)}
			{s.rebaseStatus === "success" && (
				<ResultCard variant="success">
					<ResultText variant="success">
						{t("end.rebaseResult")}: {s.targetBranch}
					</ResultText>
				</ResultCard>
			)}
			{s.rebaseStatus === "conflict" && (
				<div class="warning-card">{t("end.conflictWarning")}</div>
			)}
			{s.rebaseStatus === "error" && (
				<ResultCard variant="error">
					<ResultText variant="error">{s.rebaseError}</ResultText>
				</ResultCard>
			)}

			{/* ── Step 3: Push ── */}
			{s.rebaseStatus === "success" && s.pushStatus === "idle" && (
				<button class="action-btn" type="button" onClick={doPush}>
					{t("end.pushBtn")} {s.currentBranch}
				</button>
			)}
			{s.pushStatus === "running" && (
				<LoadingRow text={`${t("end.pushing")}...`} />
			)}
			{s.pushStatus === "success" && (
				<ResultCard variant="success">
					<ResultText variant="success">
						{t("end.pushResult")}: {s.currentBranch}
					</ResultText>
				</ResultCard>
			)}
			{s.pushStatus === "error" && (
				<ResultCard variant="error">
					<ResultText variant="error">{s.pushError}</ResultText>
				</ResultCard>
			)}

			{/* ── Step 4: Ticket keys ── */}
			{s.ticketsLoading && <LoadingRow text={t("end.analyzingCommits")} />}
			{s.pushStatus === "success" && !s.ticketsLoading && (
				<ResultCard>
					<div class="result-label">{t("end.ticketKeys")}</div>
					{s.ticketKeys.length > 0
						? s.ticketKeys.map((key) => (
								<span class="result-badge" style="margin-right:6px" key={key}>
									{key}
								</span>
							))
						: t("end.noTickets")}
				</ResultCard>
			)}
			{s.ticketsError && (
				<ResultCard variant="error">
					<ResultText variant="error">{s.ticketsError}</ResultText>
				</ResultCard>
			)}

			{/* ── Step 5: Create MR ── */}
			{s.pushStatus === "success" &&
				!s.ticketsLoading &&
				s.mrStatus === "idle" && (
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
			{s.mrStatus === "running" && <LoadingRow text={t("end.creatingMR")} />}
			{s.mrStatus === "success" && s.mrUrl && (
				<ResultCard variant="success">
					<ResultText variant="success">{t("end.mrCreated")}</ResultText>
					<div class="mr-url-row">
						<input class="mr-url-input" type="text" readOnly value={s.mrUrl} />
						<a
							class="result-key"
							href={s.mrUrl}
							target="_blank"
							rel="noreferrer"
							style="font-size:12px;padding:8px 12px;border-radius:6px"
						>
							{t("end.mrUrl")}
						</a>
						<CopyButton text={t("end.copy")} copyText={s.mrUrl} />
					</div>
				</ResultCard>
			)}
			{s.mrStatus === "error" && (
				<ResultCard variant="error">
					<ResultText variant="error">{s.mrError}</ResultText>
				</ResultCard>
			)}
			{s.mrStatus === "skipped" && (
				<ResultCard>
					<div class="result-label">
						{t("end.manualMR")} {s.targetBranch}
					</div>
				</ResultCard>
			)}

			{/* ── Step 6: Jira transitions ── */}
			{(s.mrStatus === "success" || s.mrStatus === "skipped") &&
				s.ticketKeys.length > 0 && (
					<div class="ticket-list">
						{s.ticketKeys.map((key) => (
							<div class="ticket-item" key={key}>
								<div style="flex:1">
									<a
										class="ticket-key"
										href={`${s.jiraHost}/browse/${key}`}
										target="_blank"
										rel="noreferrer"
									>
										{key}
									</a>
									{s.jiraResults[key] && (
										<span class="ticket-status success" style="margin-left:8px">
											→ {s.jiraResults[key]}
										</span>
									)}
									{s.jiraErrors[key] && (
										<span class="ticket-status error" style="margin-left:8px">
											{t("end.transitionFailed")}
										</span>
									)}
								</div>
								{s.jiraStatus[key] === "success" ? (
									<span class="result-badge">{t("end.transitionSuccess")}</span>
								) : s.jiraStatus[key] === "loading" ? (
									<span class="spinner" />
								) : (
									(() => {
										const transitions = s.jiraTransitions[key];
										if (!transitions || transitions.length === 0) return null;
										return (
											<div class="ticket-transitions">
												{transitions
													.filter(
														(tr) =>
															tr.name === "完成" ||
															tr.name === "Done" ||
															tr.name.toLowerCase().includes("done"),
													)
													.slice(0, 1)
													.map((tr) => (
														<button
															key={tr.id}
															class="trans-btn primary"
															type="button"
															onClick={() => doTransition(key, tr.id)}
															disabled={s.jiraStatus[key] === "loading"}
														>
															{tr.name}
														</button>
													))}
												{transitions
													.filter(
														(tr) =>
															tr.name !== "完成" &&
															tr.name !== "Done" &&
															!tr.name.toLowerCase().includes("done"),
													)
													.slice(0, 3)
													.map((tr) => (
														<button
															key={`${key}-${tr.id}`}
															class="trans-btn"
															type="button"
															onClick={() => doTransition(key, tr.id)}
															disabled={s.jiraStatus[key] === "loading"}
														>
															{tr.name}
														</button>
													))}
											</div>
										);
									})()
								)}
							</div>
						))}
					</div>
				)}

			{/* ── Done + Rerun ── */}
			{allDone && (
				<ResultCard variant="success">
					<ResultText variant="success">{t("end.done")}</ResultText>
				</ResultCard>
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
