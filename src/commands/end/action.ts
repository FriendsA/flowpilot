import * as clack from "@clack/prompts";
import { writeText } from "tinyclip";
import pc from "picocolors";
import { GitlabController } from "../../gitlab-controller";
import { t } from "../../i18n/cli";
import { JiraController } from "../../jira-controller";
import { openPage } from "../../server";
import { validateConfigOrWarn } from "../../utils/config";
import {
	extractTicketKeys,
	getCommitMessagesSinceAsync,
	getCurrentBranch,
	getLocalBranches,
	getReflogSourceBranch,
	gitFetchAsync,
	gitPushAsync,
	gitRebaseAsync,
	isGitRepo,
} from "../../utils/git";
import { createMrWithFallback, generateMrDescription, resolveProjectFromRemote } from "../../utils/mr";

const AUTOSELECT_THRESHOLD = 30;

interface EndActionProps {
	branch?: string;
	b?: string;
	open?: boolean;
	o?: boolean;
	"--": unknown[];
}

function stopSpinner(s: ReturnType<typeof clack.spinner>, msg: string) {
	try {
		s.stop(msg);
	} catch {
		/* already stopped */
	}
}

export const endAction = async (options: EndActionProps) => {
	if (options.open) {
		openPage(`/end?cwd=${encodeURIComponent(process.cwd())}`);
		return;
	}

	if (!validateConfigOrWarn()) return;
	if (!isGitRepo()) {
		clack.log.error(pc.red(t("end.notGitRepo")));
		return;
	}

	const gitlab = new GitlabController();
	const jira = new JiraController();

	clack.intro(pc.bgCyan(pc.black(" FlowPilot ")));

	const currentBranch = getCurrentBranch();

	// ── Step 1: Detect source branch ──

	let targetBranch: string;

	if (options.branch) {
		targetBranch = options.branch;
	} else {
		const detected = getReflogSourceBranch(currentBranch);
		if (detected) {
			const confirm = await clack.confirm({
				message: `${t("end.confirmBranch")} ${pc.cyan(detected)} ?`,
			});
			if (clack.isCancel(confirm) || confirm === false) {
				// Let user pick manually
				const branches = getLocalBranches();
				const pick = await clack.select({
					message: t("end.selectBranch"),
					options: branches.map((b) => ({ value: b, label: b })),
				});
				if (clack.isCancel(pick)) {
					clack.cancel(t("end.aborted"));
					return;
				}
				targetBranch = pick as string;
			} else {
				targetBranch = detected;
			}
		} else {
			const branches = getLocalBranches();
			const pick = await clack.select({
				message: t("end.selectBranch"),
				options: branches.map((b) => ({ value: b, label: b })),
			});
			if (clack.isCancel(pick)) {
				clack.cancel(t("end.aborted"));
				return;
			}
			targetBranch = pick as string;
		}
	}

	// ── Step 2: Rebase onto target branch ──

	const s = clack.spinner();
	s.start(`${t("end.rebasing")} ${pc.cyan(targetBranch)}...`);

	try {
		await gitFetchAsync("origin", targetBranch);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		stopSpinner(s, pc.red(t("end.fetchFailed")));
		clack.log.error(pc.dim(msg));
		return;
	}

	const rebaseOk = await gitRebaseAsync(`origin/${targetBranch}`);

	if (!rebaseOk) {
		stopSpinner(s, pc.yellow(t("end.conflicts")));
		clack.log.warn(pc.dim(t("end.resolveConflicts")));
		return;
	}

	stopSpinner(
		s,
		pc.green("✔") + ` ${t("end.rebaseSuccess")}: ${pc.cyan(targetBranch)}`,
	);

	// ── Step 3: Push current branch ──

	s.start(t("end.pushing"));
	try {
		await gitPushAsync("origin", currentBranch);
		stopSpinner(
			s,
			pc.green("✔") + ` ${t("end.pushSuccess")}: ${pc.cyan(currentBranch)}`,
		);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		stopSpinner(s, pc.red(t("end.pushFailed")));
		clack.log.error(pc.dim(msg));
		return;
	}

	// ── Step 4: Extract Jira ticket keys from commits ──

	s.start(t("end.analyzingCommits"));
	const messages = await getCommitMessagesSinceAsync(`origin/${targetBranch}`);
	const ticketKeys = extractTicketKeys(messages);

	if (ticketKeys.length === 0) {
		stopSpinner(s, pc.yellow("⚠") + ` ${t("end.noTickets")}`);
	} else {
		stopSpinner(
			s,
			pc.green("✔") +
				` ${t("end.foundTickets")}: ${pc.bold(ticketKeys.join(", "))}`,
		);
	}

	// ── Step 5: Create Merge Request ──

		const mrConfirm = await clack.confirm({
			message: t("end.createMR"),
		});

	let mrUrl = "";

	if (mrConfirm === true) {
		let assigneeId: number | undefined;

		// ── Resolve project & select reviewer (interactive, before spinner) ──

		let project: Awaited<ReturnType<typeof resolveProjectFromRemote>>;
		try {
			s.start(t("end.resolveProject"));
			project = await resolveProjectFromRemote(gitlab);
			stopSpinner(s, pc.green("✔") + ` ${t("end.projectResolved")}`);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			stopSpinner(s, pc.red(t("end.resolveFailed")));
			clack.log.error(pc.dim(msg));
			clack.log.info(pc.dim(`${t("end.manualMR")} ${pc.cyan(targetBranch)}`));
			clack.outro(pc.dim(t("end.done")));
			return;
		}

		const reviewerConfirm = await clack.confirm({
			message: t("end.selectReviewer"),
		});
		if (clack.isCancel(reviewerConfirm) || reviewerConfirm === false) {
			clack.log.info(pc.dim(t("end.skipReviewer")));
		} else {
			try {
				s.start(t("end.fetchingMembers"));
				const members = await gitlab.listProjectMembers(project.id as number);
				stopSpinner(s, pc.green("✔"));

				const memberList = members as unknown as Array<{
					id: number;
					name: string;
					username: string;
				}>;
				const memberOptions = [
					{ value: 0, label: t("end.skipReviewer") },
					...memberList.map((m) => ({
						value: m.id,
						label: `${m.name} (@${m.username})`,
					})),
				];
				if (memberList.length <= AUTOSELECT_THRESHOLD) {
					const pick = await clack.select({
						message: t("end.selectReviewer"),
						options: memberOptions,
					});
					if (clack.isCancel(pick)) {
						clack.log.info(pc.dim(t("end.skipReviewer")));
					} else {
						const picked = pick as number;
						if (picked !== 0) assigneeId = picked;
					}
				} else {
					const { default: Search } = await import("@inquirer/search");
					const pick = await Search({
						message: t("end.selectReviewer"),
						source: async (input: string | undefined) => {
							const all = [
								{ id: 0, name: t("end.skipReviewer"), username: "" },
								...memberList,
							];
							return all
								.filter((m) =>
									!input ||
									m.name.toLowerCase().includes(input.toLowerCase()) ||
									m.username.toLowerCase().includes(input.toLowerCase()),
								)
								.map((m) => ({
									value: String(m.id),
									name: m.name,
									description: m.username ? `@${m.username}` : "",
								}));
						},
					});
					const picked = Number(pick);
					if (picked !== 0) assigneeId = picked;
				}
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				clack.log.error(pc.dim(msg));
			}
		}

		// ── Create MR (spinner starts after all interactive steps) ──

		s.start(t("end.creatingMR"));
		try {
			const description = await generateMrDescription(jira, ticketKeys, messages);

			const result = await createMrWithFallback(gitlab, {
				projectId: project.id as number,
				sourceBranch: currentBranch,
				targetBranch,
				title: `${currentBranch} → ${targetBranch}`,
				description,
				...(assigneeId ? { assigneeId } : {}),
			});
			mrUrl = result.mrUrl;
			stopSpinner(s, pc.green("✔") + ` ${t("end.mrCreated")}${result.existing ? " (existing)" : ""}`);

			if (mrUrl) {
				await writeText(mrUrl);
				clack.log.success(
					`${pc.blue(mrUrl)} ${pc.dim(t("end.copied"))}`,
				);
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			stopSpinner(s, pc.red(t("end.mrFailed")));
			clack.log.error(pc.dim(msg));
		}
	} else {
		clack.log.info(pc.dim(`${t("end.manualMR")} ${pc.cyan(targetBranch)}`));
	}

		// ── Step 6: Update Jira issues ──

	for (const key of ticketKeys) {
		// Add comment with MR link
		if (mrUrl) {
			try {
				await jira.addComment(key, `提交问题 ${key} [代码|${mrUrl}]`);
			} catch {
				// Comment failure is not critical
			}
		}

		// Transition issue status
		const transitionConfirm = await clack.confirm({
			message: `${t("end.transitionIssue")} ${pc.bold(key)} ?`,
		});

		if (clack.isCancel(transitionConfirm)) continue;

		if (transitionConfirm === true) {
			s.start(`${t("end.transitioning")} ${key}...`);
			try {
				const transitions = await jira.getTransitions(key);
				const available = transitions.transitions ?? [];

				if (available.length === 0) {
					stopSpinner(s, pc.yellow(`${key} ${t("end.noTransitions")}`));
					continue;
				}

				// Prefer "完成" / "Done" transition, otherwise let user pick
				const doneTransition = available.find(
					(tr) =>
						tr.name === "完成" ||
						tr.name === "Done" ||
						tr.name.toLowerCase().includes("done"),
				);

				let selectedTransition;
				if (doneTransition) {
					selectedTransition = doneTransition;
				} else {
					const pick = await clack.select({
						message: `${t("end.selectTransition")} ${key}`,
						options: available.map((tr) => ({ value: tr.id, label: tr.name })),
					});
					if (clack.isCancel(pick)) continue;
					selectedTransition = available.find((tr) => tr.id === pick);
				}

				if (selectedTransition) {
					await jira.transitionIssue(key, selectedTransition.id);
					stopSpinner(
						s,
						pc.green("✔") + ` ${key} → ${pc.bold(selectedTransition.name)}`,
					);
				}
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				stopSpinner(s, pc.red(`${key} ${t("end.transitionFailed")}`));
				clack.log.error(pc.dim(msg));
			}
		} else {
			clack.log.info(pc.dim(`${t("end.manualTransition")} ${key}`));
		}
	}

	clack.outro(pc.dim(t("end.done")));
};