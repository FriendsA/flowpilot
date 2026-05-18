import * as clack from "@clack/prompts";
import search from "@inquirer/search";
import clipboardy from "clipboardy";
import pc from "picocolors";
import { ConfigJson } from "../../config";
import { GitlabController } from "../../gitlab-controller";
import { t } from "../../i18n/cli";
import { JiraController } from "../../jira-controller";
import { openPage } from "../../server";
import { validateConfigOrWarn } from "../../utils/config";
import {
	extractProjectPath,
	getGitRemoteUrl,
	hasGitRemoteOrigin,
	isGitRepo,
} from "../../utils/git";
import { cleanVersion, parsePomXml } from "../../utils/pom";
import { filterByRelevance } from "../../utils/search";

interface ReleaseActionProps {
	open?: boolean;
	o?: boolean;
	"--": unknown[];
}

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

	// ── Step 1: Resolve GitLab project ──

	let projectId: string | number;
	let projectName: string;

	if (isGitRepo() && hasGitRemoteOrigin()) {
		const s = clack.spinner();
		s.start(t("release.autoResolving"));
		const remoteUrl = getGitRemoteUrl();
		const projectPath = extractProjectPath(remoteUrl);
		try {
			const project = await gitlab.getProject(projectPath);
			projectId = project.id as number;
			projectName = project.name as string;
			stopSpinner(
				s,
				pc.green("✔") +
					` ${t("release.projectResolved")}: ${pc.bold(project.name)} (${project.pathWithNamespace ?? projectPath})`,
			);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			stopSpinner(s, pc.red(t("release.resolveFailed")));
			clack.log.error(pc.dim(msg));
			return;
		}
	} else {
		const s = clack.spinner();
		s.start(t("release.fetchingProjects"));
		let allProjects: { id: number; name: string; pathWithNamespace?: string }[];
		try {
			allProjects = (await gitlab.listProjects({
				membership: true,
			})) as unknown as typeof allProjects;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			stopSpinner(s, pc.red(`${t("release.fetchProjectsFailed")}`));
			clack.log.error(pc.dim(msg));
			return;
		}
		stopSpinner(s, `${pc.green("✔")} ${allProjects.length} projects loaded`);

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
								value: null as number | null,
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

	// ── Step 2: Select branch ──

	let selectedBranch: string;

	const s = clack.spinner();
	s.start(t("release.fetchingBranches"));
	let branches: { name: string; default?: boolean }[];
	try {
		branches = (await gitlab.listBranches(
			projectId,
		)) as unknown as typeof branches;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		stopSpinner(s, pc.red(`${t("release.fetchBranchesFailed")}`));
		clack.log.error(pc.dim(msg));
		return;
	}
	stopSpinner(s, `${pc.green("✔")} ${branches.length} branches loaded`);

	if (branches.length <= AUTOSELECT_THRESHOLD) {
		const branchChoices = branches.map((b) => ({
			value: b.name,
			label:
				b.name + (b.default ? pc.cyan(` (${t("release.defaultBranch")})`) : ""),
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
							value: null as string | null,
							name: pc.dim("(no matches)"),
							disabled: true,
						},
					];
				}
				return matched.map((m) => {
					const branch = branches.find((b) => b.name === m.name);
					if (!branch) return { value: "", name: m.name };
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

	// ── Step 3: Fetch pom.xml and extract version ──

	s.start(t("release.fetchingPom"));
	let pomInfo: {
		version: string | null;
		groupId: string | null;
		artifactId: string | null;
	};

	try {
		const file = await gitlab.getFile(projectId, "pom.xml", selectedBranch);
		const raw = Buffer.from(
			(file.content as string).replace(/\n/g, ""),
			"base64",
		).toString("utf-8");
		pomInfo = parsePomXml(raw);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes("404")) {
			stopSpinner(s, `${pc.yellow("⚠")} ${t("release.noPomFound")}`);
			return;
		}
		stopSpinner(s, pc.red(`${t("release.fetchPomFailed")}`));
		clack.log.error(pc.dim(msg));
		return;
	}
	stopSpinner(
		s,
		pc.green("✔") +
			` ${t("release.versionLabel")}: ${pc.bold(pc.green(cleanVersion(pomInfo.version)))}`,
	);

	const displayVersion = cleanVersion(pomInfo.version);
	const artifactId = pomInfo.artifactId ?? projectName;
	const versionName = `${artifactId}-${displayVersion}`;
	const summary = `${artifactId}-${displayVersion} ${t("release.releaseSuffix")}`;

	clack.log.info(
		`${t("release.artifactLabel")}: ${artifactId} | ${t("release.versionNameLabel")}: ${versionName}`,
	);

	// ── Step 4: Select Jira project ──

	s.start(t("release.fetchingJiraProjects"));
	let jiraProjects: { key: string; id: string; name?: string }[];
	try {
		jiraProjects =
			(await jira.listProjectKeys()) as unknown as typeof jiraProjects;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		stopSpinner(s, pc.red(`${t("release.fetchJiraProjectsFailed")}`));
		clack.log.error(pc.dim(msg));
		return;
	}
	stopSpinner(
		s,
		`${pc.green("✔")} ${jiraProjects.length} Jira projects loaded`,
	);

	let selectedJiraKey: string;

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
							value: null as number | null,
							name: pc.dim("(no matches)"),
							disabled: true,
						},
					];
				}
				return matched.map((m) => ({
					value: (m as { key: string; projectName?: string }).key,
					name: `${(m as { key: string; projectName?: string }).key}  ${pc.dim((m as { key: string; projectName?: string }).projectName ?? "")}`,
					description: (m as { key: string; projectName?: string })
						.projectName as string,
				}));
			},
		});

		if (pick === undefined) {
			clack.cancel(t("release.aborted"));
			return;
		}

		selectedJiraKey = pick as string;
	}

	// ── Step 5: Check if issue already exists ──

	s.start(t("release.checkingExisting"));
	try {
		const searchResult = await jira.search(
			`summary ~ "${summary}" AND project = ${selectedJiraKey}`,
			1,
		);
		if (searchResult.total > 0 && searchResult.issues?.[0]) {
			const existingKey = searchResult.issues[0].key;
			const jiraUrl = config.jiraHost
				? `${config.jiraHost}/browse/${existingKey}`
				: "";
			stopSpinner(s, `${pc.green("✔")} ${t("release.issueExists")}`);

			if (jiraUrl) {
				await clipboardy.write(jiraUrl);
				clack.log.success(
					`${pc.bold(pc.cyan(existingKey))}  ${pc.blue(jiraUrl)}  ${pc.dim("(copied to clipboard)")}`,
				);
			} else {
				clack.log.success(pc.bold(pc.cyan(existingKey)));
			}
			clack.outro(pc.dim("Done"));
			return;
		}
		stopSpinner(s, pc.dim("No existing issue found"));
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		stopSpinner(s, `${pc.yellow("⚠")} ${t("release.searchFailed")}`);
		clack.log.warn(pc.dim(msg));
		// Continue — don't return, proceed to create
	}

	// ── Step 6: Ensure Jira version ──

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
				`${pc.green("✔")} ${t("release.versionExists")}: ${versionName}`,
			);
		} else {
			const created = await jira.createVersion(selectedJiraKey, versionName);
			versionId = created.id;
			versionCreated = true;
			stopSpinner(
				s,
				`${pc.green("✔")} ${t("release.versionCreated")}: ${versionName}`,
			);
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		stopSpinner(s, pc.red(`${t("release.ensureVersionFailed")}`));
		clack.log.error(pc.dim(msg));
		return;
	}

	// ── Step 7: Create Jira issue ──

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
		const jiraUrl = config.jiraHost
			? `${config.jiraHost}/browse/${issue.key}`
			: "";
		stopSpinner(s, `${pc.green("✔")} ${t("release.issueCreated")}`);

		if (jiraUrl) {
			await clipboardy.write(jiraUrl);
			clack.log.success(
				`${pc.bold(pc.cyan(issue.key))}  ${pc.blue(jiraUrl)}  ${pc.dim("(copied to clipboard)")}`,
			);
		} else {
			clack.log.success(pc.bold(pc.cyan(issue.key)));
		}
		if (versionCreated) {
			clack.log.info(pc.dim(t("release.versionAlsoCreated")));
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		stopSpinner(s, pc.red(`${t("release.createIssueFailed")}`));
		clack.log.error(pc.dim(msg));
		return;
	}

	clack.outro(pc.dim("Done"));
};
