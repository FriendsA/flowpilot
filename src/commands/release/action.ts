import pc from "picocolors";
import prompts from "prompts";
import { ConfigJson } from "../../config";
import { GitlabController } from "../../gitlab-controller";
import { JiraController } from "../../jira-controller";
import { openPage } from "../../server";
import { validateConfigOrWarn } from "../../utils/config";
import { isGitRepo, getGitRemoteUrl, extractProjectPath } from "../../utils/git";
import { parsePomXml, cleanVersion } from "../../utils/pom";

interface ReleaseActionProps {
	open?: boolean;
	o?: boolean;
	"--": unknown[];
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

	// ── Step 1: Resolve GitLab project ──

	let projectId: string | number;
	let projectName: string;

	if (isGitRepo()) {
		console.log(pc.cyan("Detected git repository") + pc.dim(" — auto-resolving project..."));
		const remoteUrl = getGitRemoteUrl();
		const projectPath = extractProjectPath(remoteUrl);
		console.log(pc.dim(`Remote: ${remoteUrl} → ${projectPath}`));
		try {
			const project = await gitlab.getProject(projectPath);
			projectId = project.id as number;
			projectName = project.name as string;
			console.log(pc.green("✔") + ` Project: ${project.name} (${project.pathWithNamespace ?? projectPath})`);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error(pc.red("Failed to resolve GitLab project from remote URL."));
			console.error(pc.dim(msg));
			return;
		}
	} else {
		console.log(pc.cyan("Fetching GitLab projects..."));
		let projects: { id: number; name: string; pathWithNamespace?: string }[];
		try {
			projects = await gitlab.listProjects({ membership: true }) as unknown as typeof projects;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error(pc.red("Failed to fetch projects: ") + msg);
			return;
		}

		const projectChoices = projects.slice(0, 100).map((p) => ({
			title: `${p.name}  ${pc.dim(p.pathWithNamespace ?? "")}`,
			value: p.id,
		}));

		const { selectedProjectId } = await prompts({
			type: "autocomplete",
			name: "selectedProjectId",
			message: "Select GitLab project",
			choices: projectChoices,
			limit: 20,
		});

		if (!selectedProjectId) {
			console.log(pc.yellow("⚠ Aborted."));
			return;
		}

		const selectedProject = projects.find((p) => p.id === selectedProjectId);
		projectId = selectedProjectId;
		projectName = selectedProject?.name ?? String(selectedProjectId);
	}

	// ── Step 2: Select branch ──

	console.log(pc.cyan("Fetching branches..."));
	let branches: { name: string; default?: boolean }[];
	try {
		branches = await gitlab.listBranches(projectId) as unknown as typeof branches;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(pc.red("Failed to fetch branches: ") + msg);
		return;
	}

	const defaultIdx = branches.findIndex((b) => b.default);
	const branchChoices = branches.map((b) => ({
		title: b.name + (b.default ? pc.dim(" (default)") : ""),
		value: b.name,
	}));

	const { selectedBranch } = await prompts({
		type: "autocomplete",
		name: "selectedBranch",
		message: "Select branch",
		choices: branchChoices,
		limit: 20,
		initial: defaultIdx >= 0 ? defaultIdx : 0,
	});

	if (!selectedBranch) {
		console.log(pc.yellow("⚠ Aborted."));
		return;
	}

	console.log(pc.green("✔") + ` Branch: ${selectedBranch}`);

	// ── Step 3: Fetch pom.xml and extract version ──

	console.log(pc.cyan("Fetching pom.xml..."));
	let pomInfo: { version: string | null; groupId: string | null; artifactId: string | null };
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
			console.error(pc.yellow("⚠ No pom.xml found on this branch."));
			return;
		}
		console.error(pc.red("Failed to fetch pom.xml: ") + msg);
		return;
	}

	const displayVersion = cleanVersion(pomInfo.version);
	const artifactId = pomInfo.artifactId ?? projectName;
	const versionName = `${artifactId}-${displayVersion}`;
	const summary = `${artifactId}-${displayVersion} 发布申请`;

	console.log(pc.bold("Version: ") + pc.green(displayVersion));
	console.log(pc.dim(`Artifact: ${artifactId} | Version name: ${versionName}`));

	// ── Step 4: Select Jira project ──

	console.log(pc.cyan("Fetching Jira projects..."));
	let jiraProjects: { key: string; id: string; name?: string }[];
	try {
		jiraProjects = await jira.listProjectKeys() as unknown as typeof jiraProjects;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(pc.red("Failed to fetch Jira projects: ") + msg);
		return;
	}

	const jiraChoices = jiraProjects.map((p) => ({
		title: `${p.key}  ${pc.dim(p.name ?? "")}`,
		value: p.key,
	}));

	const { selectedJiraKey } = await prompts({
		type: "autocomplete",
		name: "selectedJiraKey",
		message: "Select Jira project",
		choices: jiraChoices,
		limit: 20,
	});

	if (!selectedJiraKey) {
		console.log(pc.yellow("⚠ Aborted."));
		return;
	}

	// ── Step 5: Check if issue already exists ──

	console.log(pc.cyan("Checking for existing release issue..."));
	try {
		const searchResult = await jira.search(
			`summary ~ "${summary}" AND project = ${selectedJiraKey}`,
			1,
		);
		if (searchResult.total > 0 && searchResult.issues?.[0]) {
			const existingKey = searchResult.issues[0].key;
			console.log(pc.green("✔") + " Release issue already exists:");
			console.log(pc.bold(existingKey));
			if (config.jiraHost) console.log(pc.dim(`${config.jiraHost}/browse/${existingKey}`));
			return;
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(pc.yellow("⚠ Could not search for existing issues: ") + pc.dim(msg));
	}

	// ── Step 6: Ensure Jira version ──

	console.log(pc.cyan("Ensuring Jira version..."));
	let versionId: string;
	let versionCreated = false;
	try {
		const versions = await jira.getProjectVersions(selectedJiraKey);
		const existing = versions.find((v) => v.name === versionName);
		if (existing) {
			versionId = existing.id;
			console.log(pc.green("✔") + ` Version exists: ${versionName}`);
		} else {
			const created = await jira.createVersion(selectedJiraKey, versionName);
			versionId = created.id;
			versionCreated = true;
			console.log(pc.green("✔") + ` Version created: ${versionName}`);
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(pc.red("Failed to ensure version: ") + msg);
		return;
	}

	// ── Step 7: Create Jira issue ──

	console.log(pc.cyan("Creating release issue..."));
	try {
		const issue = await jira.createIssue({
			project: { key: selectedJiraKey },
			summary,
			issuetype: { id: "10000" },
			customfield_15800: "无",
			customfield_13410: [{ id: versionId }],
			customfield_13341: [{ name: "licheng.li" }],
		});
		console.log(pc.green("✔") + " Release issue created:");
		console.log(pc.bold(issue.key));
		if (config.jiraHost) console.log(pc.dim(`${config.jiraHost}/browse/${issue.key}`));
		if (versionCreated) console.log(pc.dim(`Version ${versionName} was also created.`));
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(pc.red("Failed to create issue: ") + msg);
	}
};