import { type FC, useEffect, useReducer } from "hono/jsx";
import { render } from "hono/jsx/dom";
import {
	CopyButton,
	commonCss,
	fieldLabel,
	LoadingRow,
	PageHeader,
	pageHeaderCss,
	ResultCard,
	ResultText,
} from "../../shared/components/common";
import { Badge } from "../../shared/components/neonblade/badge";
import { CornerCutButton } from "../../shared/components/neonblade/corner-cut-button";
import { GlitchText } from "../../shared/components/neonblade/glitch-text";
import { NeonGlow } from "../../shared/components/neonblade/neon-glow";
import { NeonGlowCornerCutCard } from "../../shared/components/neonblade/neon-glow-corner-cut-card";
import { NeonInput } from "../../shared/components/neonblade/neon-input";
import { NeonSelect } from "../../shared/components/neonblade/neon-select";
import { initPromise, t } from "../../shared/i18n";

const ACCENT = "#39ff14";
const ERROR_COLOR = "#ff4444";

// ── Styles ──

const endStyle = `${commonCss}${pageHeaderCss}
  /* ── Theme: green accent overrides ── */
  .spinner { border-top-color: ${ACCENT}; }
  .result-card { border-color: rgba(57,255,20,0.08); }
  .result-success { border-color: rgba(57,255,20,0.18); }
  .result-key { color: ${ACCENT}; border-bottom-color: rgba(57,255,20,0.3); }
  .result-key:hover { border-bottom-color: ${ACCENT}; }
  .result-text.success { color: ${ACCENT}; }

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
  .cwd-input { flex: 1; min-width: 0; }
  .cwd-set-btn { flex-shrink: 0; white-space: nowrap; }

  .end-card { margin-bottom: 16px; }
  .end-card, .end-card .ngcc-card { height: auto; }
  .info-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .info-block-value {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.4;
    word-break: break-all;
  }

  .mr-url-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  /* ── Step indicator (Badge-based) ── */
  .end-steps {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 24px;
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
  }
  .end-step-sep {
    display: inline-flex;
    align-items: center;
    color: ${ACCENT};
    opacity: 0.6;
    font-size: 14px;
  }

  /* ── Ticket list ── */
  .ticket-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }
  .ticket-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .ticket-card .ngcc-card {
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  }
  .ticket-key-link {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .ticket-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; flex-wrap: wrap; }
  .ticket-transitions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .error-text { color: ${ERROR_COLOR}; font-size: 13px; margin-top: 12px; animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
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
				<PageHeader
					title={
						<GlitchText
							neon
							mode="active"
							colorA={ACCENT}
							colorB={ACCENT}
							glowColor={ACCENT}
							speed="slow"
							style="color:#39ff14"
						>
							{t("web.endTitle")}
						</GlitchText>
					}
					description={
						<NeonGlow colors={ACCENT} glowIntensity="subtle">
							{t("web.endDesc")}
						</NeonGlow>
					}
				/>
				<div class="cwd-section">
					<div class="cwd-row">
						<NeonInput
							className="cwd-input"
							color={ACCENT}
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
						<CornerCutButton
							color={ACCENT}
							variant="solid"
							size="sm"
							className="cwd-set-btn"
							disabled={!s.cwdInput.trim()}
							onClick={setCwd}
						>
							{t("end.setPath")}
						</CornerCutButton>
					</div>
					{s.cwdError && (
						<div class="error-text" role="alert">
							<NeonGlow colors={ERROR_COLOR} glowIntensity="subtle">
								{s.cwdError}
							</NeonGlow>
						</div>
					)}
				</div>
			</div>
		);
	}

	if (s.loading) {
		return (
			<div>
				<style>{endStyle}</style>
				<NeonGlowCornerCutCard
					className="end-card info-block"
					colorA={ACCENT}
					size="sm"
					hoverEffect="glow-only"
				>
					{fieldLabel(ACCENT, t("end.projectPath"))}
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						<span class="info-block-value">{s.cwd}</span>
					</NeonGlow>
				</NeonGlowCornerCutCard>
				<LoadingRow color={ACCENT} text={t("web.loading")} />
			</div>
		);
	}

	if (s.error) {
		return (
			<div>
				<style>{endStyle}</style>
				<NeonGlowCornerCutCard
					className="end-card info-block"
					colorA={ACCENT}
					size="sm"
					hoverEffect="glow-only"
				>
					{fieldLabel(ACCENT, t("end.projectPath"))}
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						<span class="info-block-value">{s.cwd}</span>
					</NeonGlow>
				</NeonGlowCornerCutCard>
				<ResultCard variant="error">
					<ResultText variant="error">{s.error}</ResultText>
				</ResultCard>
				<CornerCutButton
					color={ACCENT}
					variant="ghost"
					onClick={() => d({ type: "RESET" })}
				>
					{t("end.rerun")}
				</CornerCutButton>
			</div>
		);
	}

	const branchItems = s.localBranches.map((b) => ({ name: b }));

	return (
		<div>
			<style>{endStyle}</style>
			<PageHeader
				title={
					<GlitchText
						neon
						mode="active"
						colorA={ACCENT}
						colorB={ACCENT}
						glowColor={ACCENT}
						speed="slow"
						style="color:#39ff14"
					>
						{t("web.endTitle")}
					</GlitchText>
				}
				description={
					<NeonGlow colors={ACCENT} glowIntensity="subtle">
						{t("web.endDesc")}
					</NeonGlow>
				}
			/>

			{/* ── Project path ── */}
			<NeonGlowCornerCutCard
				className="end-card info-block"
				colorA={ACCENT}
				size="sm"
				hoverEffect="glow-only"
			>
				{fieldLabel(ACCENT, t("end.projectPath"))}
				<NeonGlow colors={ACCENT} glowIntensity="subtle">
					<span class="info-block-value">{s.cwd}</span>
				</NeonGlow>
			</NeonGlowCornerCutCard>

			{/* ── Pipeline ── */}
			<div class="end-steps">
				<Badge
					color={ACCENT}
					variant={step1Done ? "solid" : step1Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step1Done || step1Active}
				>
					{t("end.stepBranch")}
				</Badge>
				<span class="end-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={step2Done ? "solid" : step2Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step2Done || step2Active}
				>
					{t("end.stepRebase")}
				</Badge>
				<span class="end-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={step3Done ? "solid" : step3Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step3Done || step3Active}
				>
					{t("end.stepPush")}
				</Badge>
				<span class="end-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={step4Done ? "solid" : step4Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step4Done || step4Active}
				>
					{t("end.stepTickets")}
				</Badge>
				<span class="end-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={step5Done ? "solid" : step5Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step5Done || step5Active}
				>
					{t("end.stepMR")}
				</Badge>
				<span class="end-step-sep">›</span>
				<Badge
					color={ACCENT}
					variant={step6Done ? "solid" : step6Active ? "outline" : "ghost"}
					shape="corner-cut"
					size="sm"
					glow={step6Done || step6Active}
				>
					{t("end.stepJira")}
				</Badge>
			</div>

			{/* ── Step 1: Current branch + Target ── */}
			<NeonGlowCornerCutCard
				className="end-card info-block"
				colorA={ACCENT}
				size="sm"
				hoverEffect="glow-only"
			>
				{fieldLabel(ACCENT, t("end.currentBranch"))}
				<NeonGlow colors={ACCENT} glowIntensity="subtle">
					<span class="info-block-value">{s.currentBranch}</span>
				</NeonGlow>
			</NeonGlowCornerCutCard>

			<NeonSelect
				id="branch"
				color={ACCENT}
				label={t("end.targetBranch")}
				placeholder={t("end.selectBranch")}
				items={branchItems}
				value={s.targetBranch ? { name: s.targetBranch } : null}
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
				<CornerCutButton color={ACCENT} variant="solid" onClick={doRebase}>
					{t("end.rebaseBtn")} → {s.targetBranch}
				</CornerCutButton>
			)}
			{s.rebaseStatus === "running" && (
				<LoadingRow
					color={ACCENT}
					text={`${t("end.rebasing")} ${s.targetBranch}...`}
				/>
			)}
			{s.rebaseStatus === "success" && (
				<ResultCard variant="success">
					<ResultText variant="success">
						{t("end.rebaseResult")}: {s.targetBranch}
					</ResultText>
				</ResultCard>
			)}
			{s.rebaseStatus === "conflict" && (
				<NeonGlowCornerCutCard
					className="end-card"
					colorA="#e67e22"
					size="sm"
					hoverEffect="glow-only"
				>
					<NeonGlow colors="#e67e22" glowIntensity="subtle">
						{t("end.conflictWarning")}
					</NeonGlow>
				</NeonGlowCornerCutCard>
			)}
			{s.rebaseStatus === "error" && (
				<ResultCard variant="error">
					<ResultText variant="error">{s.rebaseError}</ResultText>
				</ResultCard>
			)}

			{/* ── Step 3: Push ── */}
			{s.rebaseStatus === "success" && s.pushStatus === "idle" && (
				<CornerCutButton color={ACCENT} variant="solid" onClick={doPush}>
					{t("end.pushBtn")} {s.currentBranch}
				</CornerCutButton>
			)}
			{s.pushStatus === "running" && (
				<LoadingRow color={ACCENT} text={`${t("end.pushing")}...`} />
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
			{s.ticketsLoading && (
				<LoadingRow color={ACCENT} text={t("end.analyzingCommits")} />
			)}
			{s.pushStatus === "success" && !s.ticketsLoading && (
				<ResultCard>
					{fieldLabel(ACCENT, t("end.ticketKeys"))}
					{s.ticketKeys.length > 0 ? (
						<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
							{s.ticketKeys.map((key) => (
								<Badge
									key={key}
									color={ACCENT}
									variant="outline"
									shape="pill"
									size="sm"
								>
									{key}
								</Badge>
							))}
						</div>
					) : (
						t("end.noTickets")
					)}
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
						<CornerCutButton
							color={ACCENT}
							variant="solid"
							onClick={doCreateMR}
						>
							{t("end.createMrBtn")}
						</CornerCutButton>
						<CornerCutButton
							color={ACCENT}
							variant="outline"
							onClick={() => d({ type: "MR_SKIPPED" })}
						>
							{t("end.skipMr")}
						</CornerCutButton>
					</div>
				)}
			{s.mrStatus === "running" && (
				<LoadingRow color={ACCENT} text={t("end.creatingMR")} />
			)}
			{s.mrStatus === "success" && s.mrUrl && (
				<ResultCard variant="success">
					<ResultText variant="success">{t("end.mrCreated")}</ResultText>
					<div class="mr-url-row">
						<NeonInput color={ACCENT} readOnly={true} value={s.mrUrl} />
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
					<div style="margin-bottom:4px">
						{fieldLabel(ACCENT, t("end.manualMR"))} {s.targetBranch}
					</div>
				</ResultCard>
			)}

			{/* ── Step 6: Jira transitions ── */}
			{(s.mrStatus === "success" || s.mrStatus === "skipped") &&
				s.ticketKeys.length > 0 && (
					<div class="ticket-list">
						{s.ticketKeys.map((key) => (
							<NeonGlowCornerCutCard
								className="ticket-card"
								colorA={ACCENT}
								size="sm"
								hoverEffect="glow-only"
								key={key}
							>
								<div class="ticket-left">
									<a
										class="ticket-key-link"
										href={`${s.jiraHost}/browse/${key}`}
										target="_blank"
										rel="noreferrer"
									>
										<NeonGlow colors={ACCENT} glowIntensity="subtle">
											{key}
										</NeonGlow>
									</a>
									{s.jiraResults[key] && (
										<Badge
											color={ACCENT}
											variant="ghost"
											shape="pill"
											size="xs"
										>
											→ {s.jiraResults[key]}
										</Badge>
									)}
									{s.jiraErrors[key] && (
										<Badge
											color={ERROR_COLOR}
											variant="ghost"
											shape="pill"
											size="xs"
											glow
										>
											{t("end.transitionFailed")}
										</Badge>
									)}
								</div>
								{s.jiraStatus[key] === "success" ? (
									<Badge
										color={ACCENT}
										variant="solid"
										shape="pill"
										size="xs"
										glow
									>
										{t("end.transitionSuccess")}
									</Badge>
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
														<CornerCutButton
															key={tr.id}
															color={ACCENT}
															variant="solid"
															size="xs"
															onClick={() => doTransition(key, tr.id)}
															disabled={s.jiraStatus[key] === "loading"}
														>
															{tr.name}
														</CornerCutButton>
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
														<CornerCutButton
															key={`${key}-${tr.id}`}
															color={ACCENT}
															variant="outline"
															size="xs"
															onClick={() => doTransition(key, tr.id)}
															disabled={s.jiraStatus[key] === "loading"}
														>
															{tr.name}
														</CornerCutButton>
													))}
											</div>
										);
									})()
								)}
							</NeonGlowCornerCutCard>
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
				<CornerCutButton
					color={ACCENT}
					variant="ghost"
					onClick={() => d({ type: "RESET" })}
				>
					{t("end.rerun")}
				</CornerCutButton>
			)}
		</div>
	);
};

export const mount = async (el: HTMLElement) => {
	await initPromise;
	render(<EndClient />, el);
};
