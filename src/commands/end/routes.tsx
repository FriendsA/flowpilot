import { execFileSync } from "node:child_process";
import { Hono } from "hono";
import { ConfigJson } from "../../config";
import { GitlabController } from "../../gitlab-controller";
import { translateApiError } from "../../i18n/translate-error";
import { t } from "../../i18n/web";
import { JiraController } from "../../jira-controller";
import type { Config } from "../../types";
import {
	extractTicketKeys,
	getCommitMessagesSince,
	getCurrentBranch,
	getLocalBranches,
	getReflogSourceBranch,
	isGitRepo,
} from "../../utils/git";
import { createMrWithFallback, resolveProjectFromRemote } from "../../utils/mr";

const router = new Hono();

let sessionCwd = "";

const REQUIRED_KEYS: (keyof Config)[] = [
	"jiraHost",
	"jiraName",
	"jiraPassword",
	"gitlabHost",
	"gitlabKey",
];

// ── Page ──

router.get("/", async (c) => {
	const config = new ConfigJson().getConfig();
	const missing = REQUIRED_KEYS.filter((key) => !config[key]);
	if (missing.length > 0) {
		return c.redirect("/config");
	}
	// Pass cwd from CLI via query param
	const cwdFromQuery = c.req.query("cwd");
	if (cwdFromQuery) {
		sessionCwd = cwdFromQuery;
	}
	return c.render(<div id="app">{t("web.loading")}</div>, {
		title: t("web.endTitle"),
	});
});

// ── Config ──

router.get("/api/config", async (c) => {
	const config = new ConfigJson().getConfig();
	const jiraHost = config.jiraHost ?? "";
	return c.json({
		jiraHost:
			jiraHost && /^https?:\/\//.test(jiraHost)
				? jiraHost
				: jiraHost
					? `https://${jiraHost}`
					: "",
	});
});

// ── Set cwd ──

router.post("/api/set-cwd", async (c) => {
	const { cwd } = await c.req.json<{ cwd: string }>();
	if (!cwd) {
		return c.json({ error: "cwd is required" }, 400);
	}
	// Validate it's a git repo
	if (!isGitRepo({ cwd })) {
		return c.json({ error: t("end.notGitRepo") }, 400);
	}
	sessionCwd = cwd;
	return c.json({ success: true, cwd });
});

// ── Get cwd ──

router.get("/api/cwd", (c) => {
	return c.json({ cwd: sessionCwd });
});

// ── Git status ──

router.get("/api/git/status", (c) => {
	if (!sessionCwd) return c.json({ error: "No cwd set" }, 400);
	try {
		const currentBranch = getCurrentBranch({ cwd: sessionCwd });
		const localBranches = getLocalBranches({ cwd: sessionCwd });
		const detectedSource = getReflogSourceBranch(currentBranch, {
			cwd: sessionCwd,
		});
		return c.json({ currentBranch, localBranches, detectedSource });
	} catch (e) {
		return c.json({ error: translateApiError(e) });
	}
});

// ── Rebase ──

router.post("/api/rebase", async (c) => {
	const { targetBranch } = await c.req.json<{
		targetBranch: string;
	}>();
	if (!sessionCwd) return c.json({ error: "No cwd set" }, 400);
	try {
		execFileSync("git", ["rebase", targetBranch], {
			cwd: sessionCwd,
			encoding: "utf-8",
		});
		return c.json({ success: true });
	} catch (e: unknown) {
		const stderr = (e as { stderr?: string }).stderr;
		if (typeof stderr === "string" && stderr.includes("Merge conflict")) {
			return c.json({ conflict: true });
		}
		return c.json({ error: translateApiError(e) });
	}
});

// ── Push ──

router.post("/api/push", async (c) => {
	const { branch } = await c.req.json<{ branch: string }>();
	if (!sessionCwd) return c.json({ error: "No cwd set" }, 400);
	try {
		execFileSync("git", ["push", "origin", branch], {
			cwd: sessionCwd,
			encoding: "utf-8",
		});
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: translateApiError(e) });
	}
});

// ── Commits & tickets ──

router.get("/api/commits", (c) => {
	if (!sessionCwd) return c.json({ error: "No cwd set" }, 400);
	try {
		const base = c.req.query("base") || "";
		const messages = getCommitMessagesSince(base, { cwd: sessionCwd });
		const ticketKeys = extractTicketKeys(messages);
		return c.json({ messages, ticketKeys });
	} catch (e) {
		return c.json({ error: translateApiError(e) });
	}
});

// ── Create MR ──

router.post("/api/create-mr", async (c) => {
	if (!sessionCwd) return c.json({ error: "No cwd set" }, 400);
	const body = await c.req.json<{
		sourceBranch: string;
		targetBranch: string;
		title: string;
	}>();
	try {
		const gitlab = new GitlabController();
		const project = await resolveProjectFromRemote(gitlab, {
			cwd: sessionCwd,
		});
		const result = await createMrWithFallback(gitlab, {
			projectId: Number(project.id),
			sourceBranch: body.sourceBranch,
			targetBranch: body.targetBranch,
			title: body.title,
		});
		return c.json({ url: result.mrUrl });
	} catch (e) {
		return c.json({ error: translateApiError(e) });
	}
});

// ── Jira transitions ──

router.get("/api/jira/transitions", async (c) => {
	const key = c.req.query("key");
	if (!key) return c.json({ error: "key is required" }, 400);
	try {
		const jira = new JiraController();
		const data = await jira.getTransitions(key);
		return c.json(data);
	} catch (e) {
		return c.json({ error: translateApiError(e) });
	}
});

router.post("/api/jira/transition", async (c) => {
	const { key, transitionId } = await c.req.json<{
		key: string;
		transitionId: string;
	}>();
	if (!key || !transitionId)
		return c.json({ error: "key and transitionId are required" }, 400);
	try {
		const jira = new JiraController();
		await jira.transitionIssue(key, transitionId);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: translateApiError(e) });
	}
});

// ── Jira comment ──

router.post("/api/jira/comment", async (c) => {
	const { key, comment } = await c.req.json<{
		key: string;
		comment: string;
	}>();
	if (!key) return c.json({ error: "key is required" }, 400);
	try {
		const jira = new JiraController();
		await jira.addComment(key, comment);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: translateApiError(e) });
	}
});

export const endRoutes = router;
