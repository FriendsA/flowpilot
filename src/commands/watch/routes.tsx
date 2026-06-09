import { Hono } from "hono";
import { ConfigJson } from "../../config";
import { GitlabController } from "../../gitlab-controller";
import { translateApiError } from "../../i18n/translate-error";
import { t } from "../../i18n/web";
import { JenkinsController } from "../../jenkins-controller";
import { Store } from "../../store";
import type { Config } from "../../types";
import { parsePomXml } from "../../utils/pom";

type WatchHistoryEntry = {
	id: string;
	createdAt: string;
	projectId: number;
	projectName: string;
	projectPath: string;
	branch: string;
	jenkinsJobName: string;
};

const watchStore = new Store<WatchHistoryEntry>("watch-history.json");
const dedupKey = (e: WatchHistoryEntry) =>
	`${e.projectId}:${e.branch}:${e.jenkinsJobName}`;

const REQUIRED_KEYS: (keyof Config)[] = [
	"jenkinsHost",
	"jenkinsUser",
	"jenkinsPassword",
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
		title: t("web.watchTitle"),
	});
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

router.get("/api/projects/:id/pom-info", async (c) => {
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
			jenkinsJobName: pomInfo.jenkinsJobName,
		});
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabFile") }, 500);
	}
});

router.get("/api/jenkins/search", async (c) => {
	try {
		const jenkins = new JenkinsController();
		const jobs = await jenkins.listJobs();
		return c.json(jobs);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jenkinsSearch") }, 500);
	}
});

router.get("/api/jenkins/build", async (c) => {
	try {
		const job = c.req.query("job") || "";
		const buildStr = c.req.query("build") || "";
		const buildNumber = Number(buildStr);
		const jenkins = new JenkinsController();
		if (!buildNumber || Number.isNaN(buildNumber)) {
			const last = await jenkins.getLastBuild(job);
			if (!last) return c.json({ error: t("error.noBuild") }, 404);
			return c.json(last);
		}
		const info = await jenkins.getBuildInfo(job, buildNumber);
		return c.json(info);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jenkinsBuild") }, 500);
	}
});

router.get("/api/history", (c) => {
	return c.json(watchStore.getAll());
});

router.post("/api/history", async (c) => {
	const entry = await c.req.json<WatchHistoryEntry>();
	entry.id = entry.id || Date.now().toString(36);
	entry.createdAt = entry.createdAt || new Date().toISOString();
	watchStore.add(entry, dedupKey);
	return c.json({ ok: true });
});

router.delete("/api/history", (c) => {
	watchStore.clear();
	return c.json({ ok: true });
});

router.delete("/api/history/:id", (c) => {
	const id = c.req.param("id");
	watchStore.remove(id);
	return c.json({ ok: true });
});

export const watchRoutes = router;
