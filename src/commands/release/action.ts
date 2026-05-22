import * as clack from "@clack/prompts";
import search from "@inquirer/search";
import { writeText } from "tinyclip";
import pc from "picocolors";
import { ConfigJson } from "../../config";
import { GitlabController } from "../../gitlab-controller";
import { translateApiError } from "../../i18n/translate-error";
import { t } from "../../i18n/cli";
import { JiraController } from "../../jira-controller";
import { openPage } from "../../server";
import { Store } from "../../store";
import { validateConfigOrWarn } from "../../utils/config";
import {
	extractProjectPath,
	getGitRemoteUrl,
	hasGitRemoteOrigin,
	isGitRepo,
} from "../../utils/git";
import { createMrWithFallback } from "../../utils/mr";
import { cleanVersion, parsePomXml } from "../../utils/pom";
import { filterByRelevance } from "../../utils/search";

interface ReleaseActionProps {
	open?: boolean;
	o?: boolean;
	"--": unknown[];
}

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

const releaseStore = new Store<ReleaseHistoryEntry>("release-history.json");
const dedupKey = (e: ReleaseHistoryEntry) =>
	`${e.projectId}:${e.branch}:${e.jiraProjectKey}`;

const AUTOSELECT_THRESHOLD = 30;

function stopSpinner(s: ReturnType<typeof clack.spinner>, msg: string) {
	try {
		s.stop(msg);
	} catch {
		/* already stopped */
	}
}

export const releaseAction = async (options: ReleaseActionProps) => {
	if (options.open) {
		openPage("/release");
		return;
	}

	if (!validateConfigOrWarn()) return;

	const gitlab = new GitlabController();
	const jira = new JiraController();
	const config = new ConfigJson().getConfig();

	clack.intro(pc.bgCyan(pc.black(" FlowPilot ")));

	// ── Step 0: Select from history or create new ──

	const history = releaseStore.getAll();
	let fromHistory = false;
	let selectedEntry: ReleaseHistoryEntry | null = null;
	let projectId: string | number = "";
	let projectName = "";
	let selectedBranch = "";
	let selectedJiraKey = "";

	if (history.length > 0) {
		type HistoryOrNew = ReleaseHistoryEntry | "new";

		const historyOptions: { value: HistoryOrNew; label: string }[] =
			history.map((h) => ({
				value: h,
				label: `${h.projectName} / ${h.branch} / ${h.jiraProjectKey}${h.mrSourceBranch ? pc.dim(` MR: ${h.mrSourceBranch} → ${h.mrTargetBranch ?? h.branch}`) : ""}  ${pc.dim(h.createdAt)}`,
			}));
		historyOptions.push({
			value: "new",
			label: t("release.historyNew"),
		});

		const pick = await clack.select({
			message: t("release.selectHistoryOrNew"),
			options: historyOptions,
		});

		if (clack.isCancel(pick)) {
			clack.cancel(t("release.aborted"));
			return;
		}

		if (pick !== "new") {
			fromHistory = true;
			selectedEntry = pick as ReleaseHistoryEntry;
			projectId = selectedEntry.projectId;
			projectName = selectedEntry.projectName;
			selectedBranch = selectedEntry.branch;
			selectedJiraKey = selectedEntry.jiraProjectKey;
			clack.log.info(
				pc.green("✔") +
					` ${t("release.historyQuickExecute")}: ${selectedEntry.projectName} / ${selectedEntry.branch} / ${selectedEntry.jiraProjectKey}`,
			);
		}
	}

	// ── Step 1: Resolve GitLab project ──

	if (!fromHistory) {
		let autoResolved = false;
		if (isGitRepo() && hasGitRemoteOrigin()) {
			const s = clack.spinner();
			s.start(t("release.autoResolving"));
			const remoteUrl = getGitRemoteUrl();
			try {
				const projectPath = extractProjectPath(remoteUrl);
				const project = await gitlab.getProject(projectPath);
				projectId = project.id as number;
				projectName = project.name as string;
				autoResolved = true;
				stopSpinner(
					s,
					pc.green("✔") +
						` ${t("release.projectResolved")}: ${pc.bold(project.name)} (${project.pathWithNamespace ?? projectPath})`,
				);
			} catch (e: unknown) {
				stopSpinner(s, pc.yellow("⚠") + ` ${t("release.resolveFailed")}`);
				clack.log.warn(pc.dim(translateApiError(e, "gitlabProject")));
			}
		}

		if (!autoResolved) {
			const s = clack.spinner();
			s.start(t("release.fetchingProjects"));
			let allProjects: {
				id: number;
				name: string;
				pathWithNamespace?: string;
			}[];
			try {
				allProjects = (await gitlab.listProjects({
					membership: true,
				})) as unknown as typeof allProjects;
			} catch (e: unknown) {
				stopSpinner(s, pc.red(`${t("release.fetchProjectsFailed")}`));
				clack.log.error(pc.dim(translateApiError(e, "gitlabProject")));
				return;
			}
			stopSpinner(s, pc.green("✔") + ` ${allProjects.length} projects loaded`);

			if (allProjects.length <= AUTOSELECT_THRESHOLD) {
				const choices = allProjects.map((p) => ({
					value: p.id,
					label: `${p.name}  ${pc.dim(p.pathWithNamespace ?? "")}`,
				}));

				const selectedId = await clack.select({
					message: t("release.selectProject"),
					options: choices,
				});

				if (clack.isCancel(selectedId)) {
					clack.cancel(t("release.aborted"));
					return;
				}

				const picked = allProjects.find((p) => p.id === selectedId);
				projectId = selectedId as number;
				projectName = picked?.name ?? String(selectedId);
			} else {
				const selectedId = await search({
					message: t("release.selectProject"),
					source: async (term: string | undefined) => {
						const matched = filterByRelevance(
							allProjects.map((p) => ({
								name: p.name,
								path: p.pathWithNamespace ?? "",
								id: p.id,
							})),
							term ?? "",
							30,
						);
						if (matched.length === 0) {
							return [
								{
									value: null as any,
									name: pc.dim("(no matches)"),
									disabled: true,
								},
							];
						}
						return matched.map((p) => ({
							value: p.id,
							name: `${p.name}  ${pc.dim(p.path ?? "")}`,
							description: p.path,
						}));
					},
				});

				if (selectedId === undefined) {
					clack.cancel(t("release.aborted"));
					return;
				}

				const picked = allProjects.find((p) => p.id === selectedId);
				projectId = selectedId as number;
				projectName = picked?.name ?? String(selectedId);
			}
		}
	}

	// ── Step 2: Select branch ──

	if (!fromHistory) {
		const s = clack.spinner();
		s.start(t("release.fetchingBranches"));
		let branches: { name: string; default?: boolean }[];
		try {
			branches = (await gitlab.listBranches(
				projectId,
			)) as unknown as typeof branches;
		} catch (e: unknown) {
			stopSpinner(s, pc.red(`${t("release.fetchBranchesFailed")}`));
			clack.log.error(pc.dim(translateApiError(e, "gitlabBranch")));
			return;
		}
		stopSpinner(s, pc.green("✔") + ` ${branches.length} branches loaded`);

		if (branches.length <= AUTOSELECT_THRESHOLD) {
			const branchChoices = branches.map((b) => ({
				value: b.name,
				label:
					b.name +
					(b.default ? pc.cyan(` (${t("release.defaultBranch")})`) : ""),
			}));
			const defaultBranch = branches.find((b) => b.default)?.name;

			const pick = await clack.select({
				message: t("release.selectBranch"),
				options: branchChoices,
				initialValue: defaultBranch,
			});

			if (clack.isCancel(pick)) {
				clack.cancel(t("release.aborted"));
				return;
			}

			selectedBranch = pick as string;
		} else {
			const pick = await search({
				message: t("release.selectBranch"),
				source: async (term: string | undefined) => {
					const matched = filterByRelevance(
						branches.map((b) => ({ name: b.name, path: b.name })),
						term ?? "",
						30,
					);
					if (matched.length === 0) {
						return [
							{
								value: null as any,
								name: pc.dim("(no matches)"),
								disabled: true,
							},
						];
					}
					return matched.map((m) => {
						const branch = branches.find((b) => b.name === m.name)!;
						return {
							value: branch.name,
							name:
								branch.name +
								(branch.default
									? pc.cyan(` (${t("release.defaultBranch")})`)
									: ""),
							description: branch.default ? "default branch" : undefined,
						};
					});
				},
			});

			if (pick === undefined) {
				clack.cancel(t("release.aborted"));
				return;
			}

			selectedBranch = pick as string;
		}
	}

	// ── Step 3: Fetch pom.xml and extract version ──

	const s = clack.spinner();
	s.start(t("release.fetchingPom"));
	let pomInfo: {
		version: string | null;
		groupId: string | null;
		flowPilotName: string | null;
	};

	try {
		const file = await gitlab.getFile(projectId, "pom.xml", selectedBranch);
		const raw = Buffer.from(
			(file.content as string).replace(/\n/g, ""),
			"base64",
		).toString("utf-8");
		pomInfo = parsePomXml(raw);
	} catch (e: unknown) {
		const translated = translateApiError(e, "gitlabFile");
		if (translated === t("error.http404File") || translated === t("error.http404Project")) {
			stopSpinner(s, pc.yellow("⚠") + ` ${t("release.noPomFound")}`);
			return;
		}
		stopSpinner(s, pc.red(`${t("release.fetchPomFailed")}`));
		clack.log.error(pc.dim(translated));
		return;
	}
	stopSpinner(
		s,
		pc.green("✔") +
			` ${t("release.versionLabel")}: ${pc.bold(pc.green(cleanVersion(pomInfo.version)))}`,
	);

	const displayVersion = cleanVersion(pomInfo.version);
	const flowPilotName = pomInfo.flowPilotName ?? projectName;
	const versionName = `${flowPilotName}-${displayVersion}`;
	const summary = `${flowPilotName}-${displayVersion} ${t("release.releaseSuffix")}`;

	clack.log.info(
		`${t("release.flowPilotNameLabel")}: ${flowPilotName} | ${t("release.versionNameLabel")}: ${versionName}`,
	);

	// ── Step 4: Select Jira project ──

	if (!fromHistory) {
		s.start(t("release.fetchingJiraProjects"));
		let jiraProjects: { key: string; id: string; name?: string }[];
		try {
			jiraProjects =
				(await jira.listProjectKeys()) as unknown as typeof jiraProjects;
		} catch (e: unknown) {
			stopSpinner(s, pc.red(`${t("release.fetchJiraProjectsFailed")}`));
			clack.log.error(pc.dim(translateApiError(e, "jiraProject")));
			return;
		}
		stopSpinner(
			s,
			pc.green("✔") + ` ${jiraProjects.length} Jira projects loaded`,
		);

		if (jiraProjects.length <= AUTOSELECT_THRESHOLD) {
			const jiraChoices = jiraProjects.map((p) => ({
				value: p.key,
				label: `${p.key}  ${pc.dim(p.name ?? "")}`,
			}));

			const pick = await clack.select({
				message: t("release.selectJiraProject"),
				options: jiraChoices,
			});

			if (clack.isCancel(pick)) {
				clack.cancel(t("release.aborted"));
				return;
			}
			selectedJiraKey = pick as string;
		} else {
			const pick = await search({
				message: t("release.selectJiraProject"),
				source: async (term: string | undefined) => {
					const matched = filterByRelevance(
						jiraProjects.map((p) => ({
							name: `${p.key} ${p.name ?? ""}`,
							path: p.key,
							key: p.key,
							projectName: p.name,
						})),
						term ?? "",
						30,
					);
					if (matched.length === 0) {
						return [
							{
								value: null as any,
								name: pc.dim("(no matches)"),
								disabled: true,
							},
						];
					}
					return matched.map((m) => ({
						value: (m as any).key,
						name: `${(m as any).key}  ${pc.dim((m as any).projectName ?? "")}`,
						description: (m as any).projectName,
					}));
				},
			});

			if (pick === undefined) {
				clack.cancel(t("release.aborted"));
				return;
			}

			selectedJiraKey = pick as string;
		}
	}

	let jiraUrl = "";
	let issueExists = false;

	// ── Step 5: Check if issue already exists ──

	s.start(t("release.checkingExisting"));
	try {
		const searchResult = await jira.search(
			`summary ~ "${summary}" AND project = ${selectedJiraKey}`,
			1,
		);
		if (searchResult.total > 0 && searchResult.issues?.[0]) {
			const existingKey = searchResult.issues[0].key;
			jiraUrl = config.jiraHost
				? `${config.jiraHost}/browse/${existingKey}`
				: "";
			stopSpinner(s, pc.green("✔") + ` ${t("release.issueExists")}`);
			issueExists = true;

			if (jiraUrl) {
				await writeText(jiraUrl);
				clack.log.success(
					`${pc.bold(pc.cyan(existingKey))}  ${pc.blue(jiraUrl)}  ${pc.dim(t("end.copied"))}`,
				);
			} else {
				clack.log.success(pc.bold(pc.cyan(existingKey)));
			}
		}
		if (!issueExists) stopSpinner(s, pc.dim("No existing issue found"));
	} catch (e: unknown) {
		stopSpinner(s, pc.yellow("⚠") + ` ${t("release.searchFailed")}`);
		clack.log.warn(pc.dim(translateApiError(e, "jiraSearch")));
	}

	// ── Step 6 & 7: Create version and issue (only if not found) ──

	if (!issueExists) {
		s.start(t("release.ensuringVersion"));
		let versionId: string;
		let versionCreated = false;
		try {
			const versions = await jira.getProjectVersions(selectedJiraKey);
			const existing = versions.find((v) => v.name === versionName);
			if (existing) {
				versionId = existing.id;
				stopSpinner(
					s,
					pc.green("✔") + ` ${t("release.versionExists")}: ${versionName}`,
				);
			} else {
				const created = await jira.createVersion(selectedJiraKey, versionName);
				versionId = created.id;
				versionCreated = true;
				stopSpinner(
					s,
					pc.green("✔") + ` ${t("release.versionCreated")}: ${versionName}`,
				);
			}
		} catch (e: unknown) {
			stopSpinner(s, pc.red(`${t("release.ensureVersionFailed")}`));
			clack.log.error(pc.dim(translateApiError(e, "jiraVersion")));
			return;
		}

		s.start(t("release.creatingIssue"));
		try {
			const issue = await jira.createIssue({
				project: { key: selectedJiraKey },
				summary,
				issuetype: { id: "10000" },
				customfield_15800: "无",
				customfield_13410: [{ id: versionId }],
				customfield_13341: [{ name: "licheng.li" }],
			});
			jiraUrl = config.jiraHost
				? `${config.jiraHost}/browse/${issue.key}`
				: "";
			stopSpinner(s, pc.green("✔") + ` ${t("release.issueCreated")}`);

			if (jiraUrl) {
				await writeText(jiraUrl);
				clack.log.success(
					`${pc.bold(pc.cyan(issue.key))}  ${pc.blue(jiraUrl)}  ${pc.dim(t("end.copied"))}`,
				);
			} else {
				clack.log.success(pc.bold(pc.cyan(issue.key)));
			}
			if (versionCreated) {
				clack.log.info(pc.dim(t("release.versionAlsoCreated")));
			}
		} catch (e: unknown) {
			stopSpinner(s, pc.red(`${t("release.createIssueFailed")}`));
			clack.log.error(pc.dim(translateApiError(e, "jiraCreateIssue")));
			return;
		}
	}

	// ── Step 8: Optionally create Merge Request ──

	// From history with stored mrSourceBranch: create MR directly using stored branches
	// From history without mrSourceBranch: skip MR (was not created originally)
	// New entry: ask whether to create MR, then pick source branch

	let shouldCreateMr = false;
	let mrSourceBranch = "";
	let mrTargetBranch = "";
	let mrUrl = "";

	if (fromHistory && selectedEntry?.mrSourceBranch) {
		shouldCreateMr = true;
		mrSourceBranch = selectedEntry.mrSourceBranch;
		mrTargetBranch = selectedEntry.mrTargetBranch ?? selectedEntry.branch;
		clack.log.info(pc.dim(`MR: ${mrSourceBranch} → ${mrTargetBranch}`));
	} else if (!fromHistory) {
		const createMr = await clack.confirm({
			message: t("release.createMR"),
		});

		if (clack.isCancel(createMr)) {
			clack.outro(pc.dim(t("end.done")));
			return;
		}

		if (createMr) {
			shouldCreateMr = true;
			const mrSpinner = clack.spinner();
			mrSpinner.start(t("release.fetchingBranches"));
			let mrBranches: { name: string; default?: boolean }[];
			try {
				mrBranches = (await gitlab.listBranches(
					projectId,
				)) as unknown as typeof mrBranches;
			} catch (e: unknown) {
				stopSpinner(mrSpinner, pc.red(`${t("release.fetchBranchesFailed")}`));
				clack.log.error(pc.dim(translateApiError(e, "gitlabBranch")));
				clack.outro(pc.dim(t("end.done")));
				return;
			}
			stopSpinner(mrSpinner, pc.green("✔") + ` ${mrBranches.length} branches loaded`);

			const mrBranchChoices = mrBranches
				.filter((b) => b.name !== selectedBranch);

			if (mrBranchChoices.length === 0) {
				clack.log.warn(pc.yellow(t("release.noSourceBranches")));
				clack.outro(pc.dim(t("end.done")));
				return;
			}

			if (mrBranchChoices.length <= AUTOSELECT_THRESHOLD) {
				const sourceChoices = mrBranchChoices.map((b) => ({
					value: b.name,
					label:
						b.name +
						(b.default ? pc.cyan(` (${t("release.defaultBranch")})`) : ""),
				}));
				const defaultBranch = mrBranchChoices.find((b) => b.default)?.name;

				const sourceBranchPick = await clack.select({
					message: t("release.selectSourceBranch"),
					options: sourceChoices,
					initialValue: defaultBranch,
				});

				if (clack.isCancel(sourceBranchPick)) {
					clack.cancel(t("release.aborted"));
					return;
				}

				mrSourceBranch = sourceBranchPick as string;
			} else {
				const sourceBranchPick = await search({
					message: t("release.selectSourceBranch"),
					source: async (term: string | undefined) => {
						const matched = filterByRelevance(
							mrBranchChoices.map((b) => ({ name: b.name, path: b.name })),
							term ?? "",
							30,
						);
						if (matched.length === 0) {
							return [
								{
									value: null as any,
									name: pc.dim("(no matches)"),
									disabled: true,
								},
							];
						}
						return matched.map((m) => {
							const branch = mrBranchChoices.find((b) => b.name === m.name)!;
							return {
								value: branch.name,
								name:
									branch.name +
									(branch.default
										? pc.cyan(` (${t("release.defaultBranch")})`)
										: ""),
								description: branch.default ? "default branch" : undefined,
							};
						});
					},
				});

				if (sourceBranchPick === undefined) {
					clack.cancel(t("release.aborted"));
					return;
				}

				mrSourceBranch = sourceBranchPick as string;
			}

			mrTargetBranch = selectedBranch;
		}
	}

	if (shouldCreateMr) {
		const mrSpinner = clack.spinner();
		mrSpinner.start(t("end.creatingMR"));
		mrUrl = "";
		try {
			const result = await createMrWithFallback(gitlab, {
				projectId: projectId as number,
				sourceBranch: mrSourceBranch,
				targetBranch: mrTargetBranch,
				title: `${mrSourceBranch} → ${mrTargetBranch}`,
				description: jiraUrl ? `Jira: ${jiraUrl}` : "",
			});
			mrUrl = result.mrUrl;
			stopSpinner(
				mrSpinner,
				pc.green("✔") +
					` ${t("release.mrCreated")}${result.existing ? " (existing)" : ""}`,
			);
		} catch (e: unknown) {
			stopSpinner(mrSpinner, pc.red(t("end.mrFailed")));
			clack.log.error(pc.dim(translateApiError(e, "gitlabMR")));
		}

		if (mrUrl) {
			await writeText(mrUrl);
			clack.log.success(
				`${pc.blue(mrUrl)} ${pc.dim(t("end.copied"))}`,
			);

			// Update history entry with MR info
			const current = releaseStore.getAll();
			const match = current.find(
				(e) => e.projectId === (projectId as number) && e.branch === mrTargetBranch,
			);
			if (match) {
				releaseStore.add({
					...match,
					mrUrl,
					mrSourceBranch,
					mrTargetBranch,
				}, dedupKey);
			}
		}
	}

	// ── Step 9: Save to history ──

	if (!fromHistory) {
		releaseStore.add({
			id: `${Date.now()}`,
			createdAt: new Date().toLocaleString(),
			projectId: projectId as number,
			projectName,
			projectPath: "",
			branch: selectedBranch,
			jiraProjectKey: selectedJiraKey,
			...(mrUrl ? { mrUrl, mrSourceBranch, mrTargetBranch } : {}),
		}, dedupKey);
	}

	clack.outro(pc.dim(t("end.done")));
};