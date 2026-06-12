import * as clack from "@clack/prompts";
import pc from "picocolors";
import { writeText } from "tinyclip";
import { GitlabController } from "../../gitlab-controller";
import { t } from "../../i18n/cli";
import { JiraController } from "../../jira-controller";
import { openPage } from "../../server";
import { Store } from "../../store";
import { validateConfigOrWarn } from "../../utils/config";
import {
	extractTicketKeys,
	getCommitMessagesSinceAsync,
	getCurrentBranch,
	getLocalBranches,
	getReflogSourceBranch,
	gitPushAsync,
	isGitRepo,
} from "../../utils/git";
import {
	createMrWithFallback,
	generateMrDescription,
	resolveProjectFromRemote,
} from "../../utils/mr";
import { searchSelect } from "../../utils/search";

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
	labels: string[] | undefined;
	draft: boolean | undefined;
	reviewerId: number | undefined;
	ticketKeys: string[];
};

const mrStore = new Store<MrHistoryEntry>("mr-history.json");
const dedupKey = (e: MrHistoryEntry) =>
	`${e.projectId}:${e.sourceBranch}:${e.targetBranch}`;

function stopSpinner(s: ReturnType<typeof clack.spinner>, msg: string) {
	try {
		s.stop(msg);
	} catch {
		/* already stopped */
	}
}

interface MrActionProps {
	target?: string;
	t?: string;
	open?: boolean;
	o?: boolean;
	draft?: boolean;
	"--": unknown[];
}

export const mrAction = async (options: MrActionProps) => {
	if (options.open) {
		openPage(`/mr?cwd=${encodeURIComponent(process.cwd())}`);
		return;
	}

	if (!validateConfigOrWarn()) return;
	if (!isGitRepo()) {
		clack.log.error(pc.red(t("mr.notGitRepo")));
		return;
	}

	const gitlab = new GitlabController();
	const jira = new JiraController();

	clack.intro(pc.bgCyan(pc.black(" FlowPilot MR ")));

	const currentBranch = getCurrentBranch();
	const s = clack.spinner();

	// ── Step 0: History selection ──

	const history = mrStore.getAll();
	let fromHistory = false;
	let selectedEntry: MrHistoryEntry | null = null;
	let targetBranch = "";
	let projectId: number = 0;
	let projectName = "";
	let mrTitle = "";
	let mrDescription = "";
	let ticketKeys: string[] = [];

	if (history.length > 0) {
		type HistoryOrNew = MrHistoryEntry | "new";

		const historyOptions: { value: HistoryOrNew; label: string }[] =
			history.map((h) => ({
				value: h,
				label: `${h.projectName} / ${h.sourceBranch} → ${h.targetBranch}${h.mrUrl ? pc.dim(" ✓") : ""}  ${pc.dim(h.createdAt)}`,
			}));
		historyOptions.push({
			value: "new",
			label: t("mr.historyNew"),
		});

		const pick = await clack.select({
			message: t("mr.selectHistoryOrNew"),
			options: historyOptions,
		});

		if (clack.isCancel(pick)) {
			clack.cancel(t("mr.aborted"));
			return;
		}

		if (pick !== "new") {
			fromHistory = true;
			selectedEntry = pick as MrHistoryEntry;
			projectId = selectedEntry.projectId;
			projectName = selectedEntry.projectName;
			targetBranch = selectedEntry.targetBranch;
			mrTitle = selectedEntry.title;
			ticketKeys = selectedEntry.ticketKeys;
			clack.log.info(
				pc.green("✔") +
					` ${t("mr.historyQuickExecute")}: ${selectedEntry.projectName} / ${selectedEntry.sourceBranch} → ${selectedEntry.targetBranch}`,
			);
		}
	}

	// ── Step 1: Detect branches ──

	clack.log.step(`${t("mr.currentBranch")}: ${pc.cyan(currentBranch)}`);

	if (!fromHistory) {
		if (options.target || options.t) {
			targetBranch = options.target ?? options.t ?? "";
		} else {
			const detected = getReflogSourceBranch(currentBranch);
			if (detected) {
				const confirm = await clack.confirm({
					message: `${t("mr.confirmBranch")} ${pc.cyan(detected)} ?`,
				});
				if (clack.isCancel(confirm) || confirm === false) {
					const branches = getLocalBranches();
					const pick = await searchSelect(t("mr.selectBranch"), (term) => {
						const filtered = !term
							? branches
							: branches.filter((b) =>
									b.toLowerCase().includes(term.toLowerCase()),
								);
						return filtered.map((b) => ({ value: b, name: b }));
					});
					if (pick === undefined) {
						clack.cancel(t("mr.aborted"));
						return;
					}
					targetBranch = pick;
				} else {
					targetBranch = detected;
				}
			} else {
				const branches = getLocalBranches();
				const pick = await searchSelect(t("mr.selectBranch"), (term) => {
					const filtered = !term
						? branches
						: branches.filter((b) =>
								b.toLowerCase().includes(term.toLowerCase()),
							);
					return filtered.map((b) => ({ value: b, name: b }));
				});
				if (pick === undefined) {
					clack.cancel(t("mr.aborted"));
					return;
				}
				targetBranch = pick;
			}
		}
	}

	// ── Step 2: Resolve project ──

	if (!fromHistory) {
		s.start(t("mr.resolveProject"));
		try {
			const project = await resolveProjectFromRemote(gitlab);
			projectId = project.id as number;
			projectName =
				(project.name as string) ?? (project.pathWithNamespace as string) ?? "";
			stopSpinner(
				s,
				`${pc.green("✔")} ${t("mr.resolveProject")}: ${pc.cyan(projectName)}`,
			);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			stopSpinner(s, pc.red(t("mr.resolveFailed")));
			clack.log.warn(pc.dim(msg));

			// Fallback: let user search projects manually
			s.start(t("mr.fetchingProjects"));
			try {
				const projects = await gitlab.searchProjects("");
				const projectList = projects as unknown as Array<{
					id: number;
					name: string;
					pathWithNamespace: string;
				}>;
				stopSpinner(s, `${pc.green("✔")} ${t("mr.fetchingProjects")}`);

				const pick = await searchSelect(
					t("mr.selectProject"),
					async (input) => {
						const results = input
							? await gitlab.searchProjects(input)
							: projectList;
						return (
							results as unknown as Array<{
								id: number;
								name: string;
								pathWithNamespace: string;
							}>
						).map((p) => ({
							value: String(p.id),
							name: p.name,
							description: p.pathWithNamespace,
						}));
					},
				);
				if (pick === undefined) {
					clack.cancel(t("mr.aborted"));
					return;
				}
				projectId = Number(pick);
				const sel = projectList.find((p) => p.id === projectId);
				projectName = sel?.name ?? "";
			} catch (e2: unknown) {
				const msg2 = e2 instanceof Error ? e2.message : String(e2);
				stopSpinner(s, pc.red(t("mr.fetchProjectsFailed")));
				clack.log.error(pc.dim(msg2));
				return;
			}
		}
	}

	// ── Step 3: Generate title ──

	if (!fromHistory) {
		// Smart title: strip feature/bugfix/hotfix prefix, use branch→target pattern
		const stripPrefix = (branch: string) =>
			branch.replace(
				/^(feature|bugfix|hotfix|fix|chore|refactor|docs|test)\//,
				"",
			);
		const defaultTitle = `${stripPrefix(currentBranch)} → ${targetBranch}`;

		const titleInput = await clack.text({
			message: t("mr.enterTitle"),
			initialValue: defaultTitle,
		});
		if (clack.isCancel(titleInput)) {
			clack.cancel(t("mr.aborted"));
			return;
		}
		mrTitle = titleInput as string;
	}

	// ── Step 4: Generate description ──

	if (!fromHistory) {
		s.start(t("mr.generatingDescription"));
		const messages = await getCommitMessagesSinceAsync(
			`origin/${targetBranch}`,
		);
		ticketKeys = extractTicketKeys(messages);
		const autoDesc = await generateMrDescription(jira, ticketKeys, messages);
		stopSpinner(s, `${pc.green("✔")} ${t("mr.generatingDescription")}`);

		const descInput = await clack.text({
			message: t("mr.enterDescription"),
			initialValue: autoDesc,
		});
		if (clack.isCancel(descInput)) {
			clack.cancel(t("mr.aborted"));
			return;
		}
		mrDescription = descInput as string;
	}

	// ── Step 5: Push branch ──

	if (fromHistory) {
		s.start(t("mr.pushing"));
		try {
			await gitPushAsync("origin", currentBranch);
			stopSpinner(
				s,
				`${pc.green("✔")} ${t("mr.pushSuccess")}: ${pc.cyan(currentBranch)}`,
			);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			stopSpinner(s, pc.red(t("mr.pushFailed")));
			clack.log.error(pc.dim(msg));
		}
	} else {
		const pushConfirm = await clack.confirm({
			message: t("mr.pushBranch"),
		});
		if (clack.isCancel(pushConfirm)) {
			clack.log.info(pc.dim(t("mr.pushSkipped")));
		} else if (pushConfirm === true) {
			s.start(t("mr.pushing"));
			try {
				await gitPushAsync("origin", currentBranch);
				stopSpinner(
					s,
					`${pc.green("✔")} ${t("mr.pushSuccess")}: ${pc.cyan(currentBranch)}`,
				);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				stopSpinner(s, pc.red(t("mr.pushFailed")));
				clack.log.error(pc.dim(msg));
			}
		} else {
			clack.log.info(pc.dim(t("mr.pushSkipped")));
		}
	}

	// ── Step 6: Select reviewer ──

	let reviewerId: number | undefined;
	if (fromHistory) {
		reviewerId = selectedEntry?.reviewerId;
	} else {
		const reviewerConfirm = await clack.confirm({
			message: t("mr.selectReviewer"),
		});
		if (clack.isCancel(reviewerConfirm) || reviewerConfirm === false) {
			clack.log.info(pc.dim(t("mr.skipReviewer")));
		} else {
			try {
				const members = await gitlab.listProjectMembers(projectId);
				const memberList = members as unknown as Array<{
					id: number;
					name: string;
					username: string;
				}>;
				const pick = await searchSelect(t("mr.selectReviewer"), (input) => {
					const all = [
						{ id: 0, name: t("mr.skipReviewer"), username: "" },
						...memberList,
					];
					return all
						.filter(
							(m) =>
								!input ||
								m.name.toLowerCase().includes(input.toLowerCase()) ||
								m.username.toLowerCase().includes(input.toLowerCase()),
						)
						.map((m) => ({
							value: String(m.id),
							name: m.name,
							description: m.username ? `@${m.username}` : "",
						}));
				});
				if (pick === undefined) {
					clack.log.info(pc.dim(t("mr.skipReviewer")));
				} else {
					const picked = Number(pick);
					if (picked !== 0) reviewerId = picked;
				}
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				clack.log.error(pc.dim(msg));
			}
		}
	}

	// ── Step 7: Draft toggle ──

	let draft = options.draft ?? false;
	if (fromHistory) {
		draft = selectedEntry?.draft ?? false;
	} else if (!draft) {
		const draftConfirm = await clack.confirm({
			message: t("mr.confirmDraft"),
		});
		if (draftConfirm === true) draft = true;
	}

	s.start(t("mr.creatingMR"));
	let mrUrl = "";
	let mrIid: number | undefined;
	let mrExisting = false;

	try {
		const result = await createMrWithFallback(gitlab, {
			projectId,
			sourceBranch: currentBranch,
			targetBranch,
			title: mrTitle,
			description: mrDescription,
			...(reviewerId ? { assigneeId: reviewerId } : {}),
			draft,
		});

		mrUrl = result.mrUrl;
		mrIid = result.mrIid;
		mrExisting = result.existing;

		stopSpinner(
			s,
			`${pc.green("✔")} ${mrExisting ? t("mr.mrExists") : t("mr.mrCreated")}`,
		);

		if (mrUrl) {
			await writeText(mrUrl);
			clack.log.success(`${pc.blue(mrUrl)} ${pc.dim(t("mr.mrCopied"))}`);
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		stopSpinner(s, pc.red(t("mr.mrFailed")));
		clack.log.error(pc.dim(msg));
		clack.log.info(pc.dim(`${t("mr.manualMR")}`));
	}

	// ── Step 9: Jira integration ──

	for (const key of ticketKeys) {
		// Add comment with MR link
		if (mrUrl) {
			const commentConfirm = await clack.confirm({
				message: `${t("mr.addJiraComment")} ${pc.bold(key)} ?`,
			});
			if (commentConfirm === true) {
				try {
					await jira.addComment(
						key,
						t("cli.jiraCommentTemplate", { key, mrUrl }),
					);
					clack.log.success(
						`${pc.green("✔")} ${t("mr.jiraCommentAdded")}: ${key}`,
					);
				} catch {
					clack.log.warn(pc.dim(`${t("mr.jiraCommentFailed")}: ${key}`));
				}
			}
		}

		// Transition issue status
		const transitionConfirm = await clack.confirm({
			message: `${t("mr.transitionIssue")} ${pc.bold(key)} ?`,
		});

		if (clack.isCancel(transitionConfirm)) continue;

		if (transitionConfirm === true) {
			s.start(`${t("mr.transitioning")} ${key}...`);
			try {
				const transitions = await jira.getTransitions(key);
				const available = transitions.transitions ?? [];

				if (available.length === 0) {
					stopSpinner(s, pc.yellow(`${key} ${t("mr.noTransitions")}`));
					continue;
				}

				const doneTransition = available.find(
					(tr) =>
						tr.name === "完成" ||
						tr.name === "Done" ||
						tr.name.toLowerCase().includes("done"),
				);

				let selectedTransition: { id: string; name: string } | undefined;
				if (doneTransition) {
					selectedTransition = doneTransition;
				} else {
					const pick = await clack.select({
						message: `${t("mr.selectTransition")} ${key}`,
						options: available.map((tr) => ({
							value: tr.id,
							label: tr.name,
						})),
					});
					if (clack.isCancel(pick)) continue;
					selectedTransition = available.find((tr) => tr.id === pick);
				}

				if (selectedTransition) {
					await jira.transitionIssue(key, selectedTransition.id);
					stopSpinner(
						s,
						`${pc.green("✔")} ${key} → ${pc.bold(selectedTransition.name)}`,
					);
				}
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				stopSpinner(s, pc.red(`${key} ${t("mr.transitionFailed")}`));
				clack.log.error(pc.dim(msg));
			}
		} else {
			clack.log.info(pc.dim(`${t("mr.manualTransition")} ${key}`));
		}
	}

	// ── Step 10: Save history ──

	// IMPORTANT: Store update must be BEFORE final return to avoid rolldown tree-shaking
	const entry: MrHistoryEntry = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		createdAt: new Date().toISOString().slice(0, 10),
		projectPath: "",
		projectId,
		projectName,
		sourceBranch: currentBranch,
		targetBranch,
		title: mrTitle,
		mrUrl,
		mrIid,
		labels: undefined,
		draft,
		reviewerId,
		ticketKeys,
	};
	mrStore.add(entry, dedupKey);

	clack.outro(pc.dim(t("mr.done")));
};
