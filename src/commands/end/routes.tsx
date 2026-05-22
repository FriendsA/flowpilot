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
	gitFetch,
	gitPush,
	gitRebase,
	isGitRepo,
} from "../../utils/git";
import { createMrWithFallback, generateMrDescription, resolveProjectFromRemote } from "../../utils/mr";

// ── Session cwd ──
// Stores the working directory for git operations.
// Set by CLI via /api/set-cwd or by web page via query param.

let sessionCwd: string | null = null;

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
	// Pass cwd from CLI via query param
	const cwdFromQuery = c.req.query("cwd");
	if (cwdFromQuery) {
		sessionCwd = cwdFromQuery;
	}
	return c.render(<div id="app">{t("web.loading")}</div>, {
		title: t("web.endTitle"),
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
	const cwd = c.req.query("cwd") || sessionCwd || undefined;
	if (!isGitRepo({ cwd })) {
		return c.json({ error: t("end.notGitRepo") }, 400);
	}
	try {
		const currentBranch = getCurrentBranch({ cwd });
		const localBranches = getLocalBranches({ cwd });
		const detectedSource = getReflogSourceBranch(currentBranch, { cwd });
		return c.json({ currentBranch, localBranches, detectedSource, cwd });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Rebase ──

router.post("/api/rebase", async (c) => {
	const { targetBranch, cwd } = await c.req.json<{
		targetBranch: string;
		cwd?: string;
	}>();
	const workDir = cwd || sessionCwd || undefined;
	if (!targetBranch) {
		return c.json({ error: "targetBranch is required" }, 400);
	}
	try {
		gitFetch("origin", targetBranch, { cwd: workDir });
		const ok = gitRebase(`origin/${targetBranch}`, { cwd: workDir });
		if (!ok) {
			return c.json({ success: false, conflict: true });
		}
		return c.json({ success: true });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Push ──

router.post("/api/push", async (c) => {
	const { branch, cwd } = await c.req.json<{
		branch: string;
		cwd?: string;
	}>();
	const workDir = cwd || sessionCwd || undefined;
	if (!branch) {
		return c.json({ error: "branch is required" }, 400);
	}
	try {
		gitPush("origin", branch, { cwd: workDir });
		return c.json({ success: true });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Commits / ticket keys ──

router.get("/api/commits", (c) => {
	const baseRef = c.req.query("base");
	const cwd = c.req.query("cwd") || sessionCwd || undefined;
	if (!baseRef) {
		return c.json({ error: "base query param is required" }, 400);
	}
	try {
		const messages = getCommitMessagesSince(`origin/${baseRef}`, { cwd });
		const ticketKeys = extractTicketKeys(messages);
		return c.json({ messages, ticketKeys });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Create MR ──

router.post("/api/create-mr", async (c) => {
	const { currentBranch, targetBranch, ticketKeys, cwd } = await c.req.json<{
		currentBranch: string;
		targetBranch: string;
		ticketKeys: string[];
		cwd?: string;
	}>();
	const workDir = cwd || sessionCwd || undefined;

	try {
		const gitlab = new GitlabController();
		const jira = new JiraController();
		const project = await resolveProjectFromRemote(gitlab, { cwd: workDir });
		const description = await generateMrDescription(jira, ticketKeys, []);

		const result = await createMrWithFallback(gitlab, {
			projectId: project.id as number,
			sourceBranch: currentBranch,
			targetBranch,
			title: `${currentBranch} → ${targetBranch}`,
			description,
		});
		return c.json({
			success: true,
			mrUrl: result.mrUrl,
			mrIid: result.mrIid,
			existing: result.existing,
		});
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabProject") }, 500);
	}
});

// ── Jira transitions ──

router.get("/api/jira/transitions", async (c) => {
	const key = c.req.query("key");
	if (!key) {
		return c.json({ error: "key is required" }, 400);
	}
	try {
		const jira = new JiraController();
		const data = await jira.getTransitions(key);
		return c.json(data);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jiraProject") }, 500);
	}
});

// ── Jira transition ──

router.post("/api/jira/transition", async (c) => {
	const { key, transitionId } = await c.req.json<{
		key: string;
		transitionId: string;
	}>();
	try {
		const jira = new JiraController();
		await jira.transitionIssue(key, transitionId);
		return c.json({ success: true });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jiraProject") }, 500);
	}
});

// ── Jira comment ──

router.post("/api/jira/comment", async (c) => {
	const { key, body } = await c.req.json<{ key: string; body: string }>();
	try {
		const jira = new JiraController();
		await jira.addComment(key, body);
		return c.json({ success: true });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "jiraProject") }, 500);
	}
});

// Module-level side-effect registration to prevent rolldown tree-shaking.
const _handlers = [
	isGitRepo,
	getCurrentBranch,
	getLocalBranches,
	getReflogSourceBranch,
	gitFetch,
	gitRebase,
	gitPush,
	getCommitMessagesSince,
	extractTicketKeys,
	GitlabController,
	JiraController,
	translateApiError,
	createMrWithFallback,
	generateMrDescription,
	resolveProjectFromRemote,
];

export { _handlers };
export const endRoutes = router;