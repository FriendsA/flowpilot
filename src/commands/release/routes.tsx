import { Hono } from "hono";
import { GitlabController } from "../../gitlab-controller";
import { JiraController } from "../../jira-controller";

const router = new Hono();

router.get("/", async (c) => {
	return c.render(<div id="app">Loading...</div>, { title: "Release" });
});

router.get("/api/projects", async (c) => {
	try {
		const git = new GitlabController();
		const projects = await git.listProjects({ membership: true });
		return c.json(projects);
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return c.json({ error: message }, 500);
	}
});

router.get("/api/projects/:id/branches", async (c) => {
	try {
		const projectId = c.req.param("id");
		const git = new GitlabController();
		const branches = await git.listBranches(projectId);
		return c.json(branches);
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return c.json({ error: message }, 500);
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
		const message = e instanceof Error ? e.message : String(e);
		return c.json({ error: message }, 500);
	}
});

router.post("/api/jira/search", async (c) => {
	try {
		const { jql, maxResults } = await c.req.json<{ jql: string; maxResults?: number }>();
		const jira = new JiraController();
		const result = await jira.search(jql, maxResults ?? 5);
		return c.json(result);
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return c.json({ error: message }, 500);
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
		const message = e instanceof Error ? e.message : String(e);
		return c.json({ error: message }, 500);
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
		const message = e instanceof Error ? e.message : String(e);
		return c.json({ error: message }, 500);
	}
});

router.get("/api/jira/projects", async (c) => {
	try {
		const jira = new JiraController();
		const projects = await jira.listProjectKeys();
		return c.json(projects);
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return c.json({ error: message }, 500);
	}
});

export const releaseRoutes = router;