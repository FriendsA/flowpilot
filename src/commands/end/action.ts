import * as clack from "@clack/prompts";
import clipboardy from "clipboardy";
import pc from "picocolors";
import { GitlabController } from "../../gitlab-controller";
import { t } from "../../i18n/cli";
import { JiraController } from "../../jira-controller";
import { openPage } from "../../server";
import { validateConfigOrWarn } from "../../utils/config";
import {
	extractProjectPath,
	extractTicketKeys,
	getCommitMessagesSince,
	getCurrentBranch,
	getGitRemoteUrl,
	getLocalBranches,
	getReflogSourceBranch,
	gitFetch,
	gitPush,
	gitRebase,
	hasGitRemoteOrigin,
	isGitRepo,
} from "../../utils/git";

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
		openPage("/end");
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
		gitFetch("origin", targetBranch);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		stopSpinner(s, pc.red(t("end.fetchFailed")));
		clack.log.error(pc.dim(msg));
		return;
	}

	const rebaseOk = gitRebase(`origin/${targetBranch}`);

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
		gitPush("origin", currentBranch);
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
	const messages = getCommitMessagesSince(`origin/${targetBranch}`);
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
		if (!hasGitRemoteOrigin()) {
			clack.log.warn(pc.yellow(t("end.noRemote")));
		} else {
			s.start(t("end.creatingMR"));
			try {
				const remoteUrl = getGitRemoteUrl();
				const projectPath = extractProjectPath(remoteUrl);
				const project = await gitlab.getProject(projectPath);

				// Fetch Jira issue summaries for description
				const issues = await Promise.all(
					ticketKeys.map(async (key) => {
						try {
							return await jira.getIssue(key);
						} catch {
							return null;
						}
					}),
				);
				const validIssues = issues.filter(
					(i): i is NonNullable<typeof i> => i !== null,
				);

				const description =
					validIssues.length > 0
						? validIssues
								.map((i) => `- ${i.key} ${i.fields.summary}`)
								.join("\n")
						: messages.join("\n");

				const mr = await gitlab.createMergeRequest(
					project.id as number,
					currentBranch,
					targetBranch,
					`${currentBranch} → ${targetBranch}`,
					{ description },
				);

				mrUrl = (mr.webUrl ?? mr.web_url) as string;
				stopSpinner(s, pc.green("✔") + ` ${t("end.mrCreated")}`);

				if (mrUrl) {
					await clipboardy.write(mrUrl);
					clack.log.success(
						`${pc.blue(mrUrl)} ${pc.dim("(copied to clipboard)")}`,
					);
				}
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				stopSpinner(s, pc.red(t("end.mrFailed")));
				clack.log.error(pc.dim(msg));
			}
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
