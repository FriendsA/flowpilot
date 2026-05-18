import { Hono } from "hono";
import { ConfigJson } from "../../config";
import { GitlabController } from "../../gitlab-controller";
import { translateApiError } from "../../i18n/translate-error";
import { t } from "../../i18n/web";
import { JiraController } from "../../jira-controller";
import { Store } from "../../store";
import type { Config } from "../../types";
import { cleanVersion, parsePomXml } from "../../utils/pom";

type ReleaseHistoryEntry = {
	id: string;
	createdAt: string;
	projectId: number;
	projectName: string;
	projectPath: string;
	branch: string;
	jiraProjectKey: string;
};

const releaseStore = new Store<ReleaseHistoryEntry>("release-history.json");
const dedupKey = (e: ReleaseHistoryEntry) =>
	`${e.projectId}:${e.branch}:${e.jiraProjectKey}`;

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
	const history = releaseStore.getAll();
	const entry = history.find((h) => h.id === id);
	if (!entry) {
		return c.json({ error: t("error.http404") }, 404);
	}

	const git = new GitlabController();
	const jira = new JiraController();
	const config = new ConfigJson().getConfig();

	// Fetch live pom.xml
	let pomInfo: {
		version: string | null;
		groupId: string | null;
		artifactId: string | null;
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
	const artifactId = pomInfo.artifactId ?? entry.projectName;
	const versionName = `${artifactId}-${displayVersion}`;
	const summary = `${artifactId}-${displayVersion} release request`;

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
			releaseStore.add(
				{ ...entry, createdAt: new Date().toISOString() },
				dedupKey,
			);
			return c.json({
				issueKey: existingKey,
				issueUrl: jiraUrl,
				version: displayVersion,
				versionCreated: false,
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

		releaseStore.add(
			{ ...entry, createdAt: new Date().toISOString() },
			dedupKey,
		);
		return c.json({
			issueKey: issue.key,
			issueUrl: jiraUrl,
			version: displayVersion,
			versionCreated,
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

		const stripped = raw.replace(/<parent>[\s\S]*?<\/parent>/, "");
		const pick = (src: string, tag: string) =>
			src.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1] ?? null;

		return c.json({
			version: pick(stripped, "version") ?? pick(raw, "version"),
			groupId: pick(stripped, "groupId") ?? pick(raw, "groupId"),
			artifactId: pick(stripped, "artifactId") ?? pick(raw, "artifactId"),
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