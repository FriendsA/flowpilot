import { Hono } from "hono";
import { ConfigJson } from "../../config";
import { GitlabController } from "../../gitlab-controller";
import { translateApiError } from "../../i18n/translate-error";
import { t } from "../../i18n/web";
import { JiraController } from "../../jira-controller";
import { Store } from "../../store";
import type { Config } from "../../types";
import { createMrWithFallback } from "../../utils/mr";
import { cleanVersion, parsePomXml } from "../../utils/pom";

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

async function createMrForRelease(
	git: GitlabController,
	projectId: number,
	targetBranch: string,
	jiraUrl: string,
	sourceBranchOverride?: string,
): Promise<
	{ mrUrl: string; sourceBranch: string; targetBranch: string } | undefined
> {
	try {
		const sourceBranch =
			sourceBranchOverride ??
			(
				(await git.listBranches(projectId)) as unknown as {
					name: string;
					default?: boolean;
				}[]
			).find((b) => b.default)?.name;
		if (!sourceBranch || sourceBranch === targetBranch) return undefined;
		try {
			const result = await createMrWithFallback(git, {
				projectId,
				sourceBranch,
				targetBranch,
				title: `${sourceBranch} → ${targetBranch}`,
				description: jiraUrl ? `Jira: ${jiraUrl}` : "",
			});
			return { mrUrl: result.mrUrl, sourceBranch, targetBranch };
		} catch {
			return undefined;
		}
	} catch {
		return undefined;
	}
}

const REQUIRED_KEYS: (keyof Config)[] = [
	"jiraHost",
	"jiraName",
	"jiraPassword",
	"gitlabHost",
	"gitlabKey",
];

const router = new Hono();

router.get("/", async (c) => {
	const config = new ConfigJson().getConfig();
	const missing = REQUIRED_KEYS.filter((key) => !config[key]);
	if (missing.length > 0) {
		return c.redirect("/config");
	}
	return c.render(<div id="app">{t("web.loading")}</div>, {
		title: t("web.releaseTitle"),
	});
});

router.get("/api/config", async (c) => {
	const config = new ConfigJson().getConfig();
	return c.json({
		jiraHost: config.jiraHost ?? "",
		gitlabHost: config.gitlabHost ?? "",
	});
});

router.get("/api/history", (c) => {
	return c.json(releaseStore.getAll());
});

router.post("/api/history", async (c) => {
	const entry = await c.req.json<ReleaseHistoryEntry>();
	entry.id = entry.id || Date.now().toString(36);
	entry.createdAt = entry.createdAt || new Date().toISOString();
	releaseStore.add(entry, dedupKey);
	return c.json({ ok: true });
});

router.delete("/api/history", (c) => {
	releaseStore.clear();
	return c.json({ ok: true });
});

router.post("/api/history/:id/execute", async (c) => {
	const id = c.req.param("id");
	const body = await c.req
		.json<{ createMr?: boolean }>()
		.catch(() => ({ createMr: false }));
	const createMr = body.createMr ?? false;
	const history = releaseStore.getAll();
	const entry = history.find((h) => h.id === id);
	if (!entry) {
		return c.json({ error: t("error.http404") }, 404);
	}

	const git = new GitlabController();
	const jira = new JiraController();
	const config = new ConfigJson().getConfig();

	// Pre-compute MR result (only if createMr requested)
	let mrResult:
		| { mrUrl: string; sourceBranch: string; targetBranch: string }
		| undefined;
	if (createMr) {
		mrResult = await createMrForRelease(
			git,
			entry.projectId,
			entry.branch,
			"",
			entry.mrSourceBranch,
		);
	}
	// Fetch live pom.xml
	let pomInfo: {
		version: string | null;
		groupId: string | null;
		flowPilotName: string | null;
	};
	try {
		const file = await git.getFile(entry.projectId, "pom.xml", entry.branch);
		const raw = Buffer.from(
			(file.content as string).replace(/\n/g, ""),
			"base64",
		).toString("utf-8");
		pomInfo = parsePomXml(raw);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabFile") }, 500);
	}

	const displayVersion = cleanVersion(pomInfo.version ?? "");
	const flowPilotName = pomInfo.flowPilotName ?? entry.projectName;
	const versionName = `${flowPilotName}-${displayVersion}`;
	const summary = `${flowPilotName}-${displayVersion} release request`;

	// Check existing issue
	try {
		const searchResult = await jira.search(
			`summary ~ "${summary}" AND project = ${entry.jiraProjectKey}`,
			1,
		);
		if (searchResult.total > 0 && searchResult.issues?.[0]) {
			const existingKey = searchResult.issues[0].key;
			const jiraUrl = config.jiraHost
				? `${config.jiraHost}/browse/${existingKey}`
				: "";
			return c.json({
				issueKey: existingKey,
				issueUrl: jiraUrl,
				version: displayVersion,
				versionCreated: false,
				issueCreated: false,
				mrUrl: mrResult?.mrUrl,
				mrSourceBranch: mrResult?.sourceBranch,
				mrTargetBranch: mrResult?.targetBranch,
			});
		}
	} catch {
		/* continue to create */
	}

	// Ensure version
	let versionId: string;
	let versionCreated = false;
	try {
		const versions = await jira.getProjectVersions(entry.jiraProjectKey);
		const existing = versions.find((v) => v.name === versionName);
		if (existing) {
			versionId = existing.id;
		} else {
			const created = await jira.createVersion(
				entry.jiraProjectKey,
				versionName,
			);
			versionId = created.id;
			versionCreated = true;
		}
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jiraVersion") }, 500);
	}

	// Create issue
	try {
		const issue = await jira.createIssue({
			project: { key: entry.jiraProjectKey },
			summary,
			issuetype: { id: "10000" },
			customfield_15800: "无",
			customfield_13410: [{ id: versionId }],
			customfield_13341: [{ name: "licheng.li" }],
		});
		const jiraUrl = config.jiraHost
			? `${config.jiraHost}/browse/${issue.key}`
			: "";

		return c.json({
			issueKey: issue.key,
			issueUrl: jiraUrl,
			version: displayVersion,
			versionCreated,
			mrUrl: mrResult?.mrUrl,
			mrSourceBranch: mrResult?.sourceBranch,
			mrTargetBranch: mrResult?.targetBranch,
		});
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jiraCreateIssue") }, 500);
	}
});

router.get("/api/projects", async (c) => {
	try {
		const git = new GitlabController();
		const projects = await git.listProjects({ membership: true });
		return c.json(projects);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabProject") }, 500);
	}
});

router.get("/api/projects/:id/branches", async (c) => {
	try {
		const projectId = c.req.param("id");
		const git = new GitlabController();
		const branches = await git.listBranches(projectId);
		return c.json(branches);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabBranch") }, 500);
	}
});

router.post("/api/create-mr", async (c) => {
	let mrUrl = "";
	let sourceBranch = "";
	let targetBranch = "";
	let projectId = 0;
	try {
		const body = await c.req.json<Record<string, string>>();
		projectId = Number(body.projectId);
		targetBranch = body.targetBranch;
		sourceBranch = body.sourceBranch;
		const jiraUrl = body.jiraUrl ?? "";
		try {
			const result = await createMrWithFallback(new GitlabController(), {
				projectId,
				sourceBranch,
				targetBranch,
				title: `${sourceBranch} → ${targetBranch}`,
				description: jiraUrl ? `Jira: ${jiraUrl}` : "",
			});
			mrUrl = result.mrUrl;
		} catch (mrErr: unknown) {
			if (!mrUrl) {
				return c.json({ error: translateApiError(mrErr, "gitlabMR") }, 500);
			}
		}
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabMR") }, 500);
	}
	// Save MR info to matching history entry (after successful creation)
	if (mrUrl && projectId) {
		try {
			const match = releaseStore
				.getAll()
				.find(
					(e) => Number(e.projectId) === projectId && e.branch === targetBranch,
				);
			if (match) {
				releaseStore.add(
					{
						...match,
						mrUrl,
						mrSourceBranch: sourceBranch,
						mrTargetBranch: targetBranch,
					},
					dedupKey,
				);
			}
		} catch {
			/* non-critical */
		}
	}
	return c.json({ mrUrl, sourceBranch, targetBranch });
});

router.get("/api/projects/:id/pom-version", async (c) => {
	try {
		const projectId = c.req.param("id");
		const ref = c.req.query("ref") || "master";
		const git = new GitlabController();

		const file = await git.getFile(projectId, "pom.xml", ref);

		const raw = Buffer.from(
			(file.content as string).replace(/\n/g, ""),
			"base64",
		).toString("utf-8");

		const pomInfo = parsePomXml(raw);

		return c.json({
			version: pomInfo.version,
			groupId: pomInfo.groupId,
			flowPilotName: pomInfo.flowPilotName,
		});
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabFile") }, 500);
	}
});

router.post("/api/jira/search", async (c) => {
	try {
		const { jql, maxResults } = await c.req.json<{
			jql: string;
			maxResults?: number;
		}>();
		const jira = new JiraController();
		const result = await jira.search(jql, maxResults ?? 5);
		return c.json(result);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jiraSearch") }, 500);
	}
});

router.post("/api/jira/ensure-version", async (c) => {
	try {
		const { projectKey, versionName } = await c.req.json<{
			projectKey: string;
			versionName: string;
		}>();
		const jira = new JiraController();
		const versions = await jira.getProjectVersions(projectKey);
		const existing = versions.find((v) => v.name === versionName);
		if (existing) {
			return c.json({ id: existing.id, name: existing.name, created: false });
		}
		const created = await jira.createVersion(projectKey, versionName);
		return c.json({ id: created.id, name: created.name, created: true });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jiraVersion") }, 500);
	}
});

router.post("/api/jira/create-issue", async (c) => {
	try {
		const body = await c.req.json<{
			projectKey: string;
			summary: string;
			issuetypeId: string;
			customfield_15800: string;
			customfield_13410: { id: string }[];
			customfield_13341: { name: string }[];
		}>();
		const jira = new JiraController();

		const issue = await jira.createIssue({
			project: { key: body.projectKey },
			summary: body.summary,
			issuetype: { id: body.issuetypeId },
			customfield_15800: body.customfield_15800,
			customfield_13410: body.customfield_13410,
			customfield_13341: body.customfield_13341,
		});
		return c.json({ key: issue.key });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jiraCreateIssue") }, 500);
	}
});

router.get("/api/jira/projects", async (c) => {
	try {
		const jira = new JiraController();
		const projects = await jira.listProjectKeys();
		return c.json(projects);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jiraProject") }, 500);
	}
});

export const releaseRoutes = router;
