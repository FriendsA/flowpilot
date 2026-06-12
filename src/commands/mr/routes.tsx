import { Hono } from "hono";
import { ConfigJson } from "../../config";
import { GitlabController } from "../../gitlab-controller";
import { translateApiError } from "../../i18n/translate-error";
import { t } from "../../i18n/web";
import { JiraController } from "../../jira-controller";
import { Store } from "../../store";
import type { Config } from "../../types";
import {
	extractProjectPath,
	extractTicketKeys,
	getCommitMessagesSince,
	getCurrentBranch,
	getGitRemoteUrl,
	getLocalBranches,
	getReflogSourceBranch,
	gitPush,
	hasGitRemoteOrigin,
	isGitRepo,
} from "../../utils/git";
import {
	createMrWithFallback,
	generateMrDescription,
	resolveProjectFromRemote,
} from "../../utils/mr";

// ── Session cwd ──

let sessionCwd: string | null = null;

const REQUIRED_KEYS: (keyof Config)[] = [
	"jiraHost",
	"jiraName",
	"jiraPassword",
	"gitlabHost",
	"gitlabKey",
];

type MrHistoryEntry = {
	id: string;
	createdAt: string;
	projectPath: string;
	projectId: number;
	projectName: string;
	sourceBranch: string;
	targetBranch: string;
	title: string;
	mrUrl: string | undefined;
	mrIid: number | undefined;
	labels: string[] | undefined;
	draft: boolean | undefined;
	reviewerId: number | undefined;
	ticketKeys: string[];
};

const mrStore = new Store<MrHistoryEntry>("mr-history.json");
const dedupKey = (e: MrHistoryEntry) =>
	`${e.projectId}:${e.sourceBranch}:${e.targetBranch}`;

const router = new Hono();

// ── Page ──

router.get("/", async (c) => {
	const config = new ConfigJson().getConfig();
	const missing = REQUIRED_KEYS.filter((key) => !config[key]);
	if (missing.length > 0) {
		return c.redirect("/config");
	}
	const cwdFromQuery = c.req.query("cwd");
	if (cwdFromQuery) {
		sessionCwd = cwdFromQuery;
	}
	return c.render(<div id="app">{t("web.loading")}</div>, {
		title: t("web.mrTitle"),
	});
});

// ── Set cwd ──

router.post("/api/set-cwd", async (c) => {
	const { cwd } = await c.req.json<{ cwd: string }>();
	if (!cwd) {
		return c.json({ error: t("error.cwdRequired") }, 400);
	}
	const isGitRepoResult = isGitRepo({ cwd });
	sessionCwd = cwd;
	return c.json({ success: true, cwd, isGitRepo: isGitRepoResult });
});

// ── Get cwd ──

router.get("/api/cwd", (c) => {
	return c.json({ cwd: sessionCwd });
});

// ── Init (mode detection) ──

router.get("/api/init", (c) => {
	const cwd = c.req.query("cwd") || sessionCwd || undefined;
	if (!cwd || !isGitRepo({ cwd })) {
		return c.json({ isGitRepo: false, mode: "remote", cwd: cwd || null });
	}
	try {
		const currentBranch = getCurrentBranch({ cwd });
		const localBranches = getLocalBranches({ cwd });
		const detectedSource = getReflogSourceBranch(currentBranch, { cwd });
		let remoteUrl = "";
		let projectPath = "";
		if (hasGitRemoteOrigin({ cwd })) {
			try {
				remoteUrl = getGitRemoteUrl({ cwd });
				projectPath = extractProjectPath(remoteUrl);
			} catch {
				/* remote resolution failed */
			}
		}
		return c.json({
			isGitRepo: true,
			mode: "local",
			cwd,
			currentBranch,
			localBranches,
			detectedSource,
			remoteUrl,
			projectPath,
		});
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Projects ──

router.get("/api/projects", async (c) => {
	try {
		const gitlab = new GitlabController();
		const projects = await gitlab.listProjects({ membership: true });
		return c.json(projects);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabProject") }, 500);
	}
});

// ── Git status ──

router.get("/api/git/status", (c) => {
	const cwd = c.req.query("cwd") || sessionCwd || undefined;
	if (!isGitRepo({ cwd })) {
		return c.json({ error: t("mr.notGitRepo") }, 400);
	}
	try {
		const currentBranch = getCurrentBranch({ cwd });
		const localBranches = getLocalBranches({ cwd });
		const detectedSource = getReflogSourceBranch(currentBranch, { cwd });
		let remoteUrl = "";
		let projectPath = "";
		if (hasGitRemoteOrigin({ cwd })) {
			try {
				remoteUrl = getGitRemoteUrl({ cwd });
				projectPath = extractProjectPath(remoteUrl);
			} catch {
				/* remote resolution failed */
			}
		}
		return c.json({
			currentBranch,
			localBranches,
			detectedSource,
			remoteUrl,
			projectPath,
			cwd,
		});
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Commits ──

router.get("/api/commits", (c) => {
	const baseRef = c.req.query("base");
	const cwd = c.req.query("cwd") || sessionCwd || undefined;
	if (!baseRef) {
		return c.json({ error: t("error.baseRequired") }, 400);
	}
	try {
		const messages = getCommitMessagesSince(`origin/${baseRef}`, { cwd });
		const ticketKeys = extractTicketKeys(messages);
		return c.json({ messages, ticketKeys });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Push ──

router.post("/api/push", async (c) => {
	const { branch, cwd } = await c.req.json<{ branch: string; cwd?: string }>();
	const workDir = cwd || sessionCwd || undefined;
	if (!branch) {
		return c.json({ error: t("error.branchRequired") }, 400);
	}
	try {
		gitPush("origin", branch, { cwd: workDir });
		return c.json({ success: true });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Project ──

router.get("/api/project", async (c) => {
	const cwd = c.req.query("cwd") || sessionCwd || undefined;
	try {
		const gitlab = new GitlabController();
		const project = await resolveProjectFromRemote(gitlab, { cwd });
		return c.json({
			projectId: project.id,
			projectName: project.name ?? project.pathWithNamespace,
			projectPath: project.pathWithNamespace,
		});
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabProject") }, 500);
	}
});

// ── Project branches ──

router.get("/api/project/:id/branches", async (c) => {
	const projectId = Number(c.req.param("id"));
	try {
		const gitlab = new GitlabController();
		const branches = await gitlab.listBranches(projectId);
		return c.json(branches);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabProject") }, 500);
	}
});

// ── Project members ──

router.get("/api/project/:id/members", async (c) => {
	const projectId = Number(c.req.param("id"));
	try {
		const gitlab = new GitlabController();
		const members = await gitlab.listProjectMembers(projectId);
		return c.json(members);
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e, "gitlabProject") }, 500);
	}
});

// ── Create MR ──

router.post("/api/create-mr", async (c) => {
	const body = await c.req.json<{
		projectId: number;
		sourceBranch: string;
		targetBranch: string;
		title: string;
		description?: string;
		assigneeId?: number;
		draft?: boolean;
		cwd?: string;
	}>();
	const _workDir = body.cwd || sessionCwd || undefined;

	try {
		const gitlab = new GitlabController();
		const result = await createMrWithFallback(gitlab, {
			projectId: body.projectId,
			sourceBranch: body.sourceBranch,
			targetBranch: body.targetBranch,
			title: body.title,
			description: body.description ?? "",
			...(body.assigneeId ? { assigneeId: body.assigneeId } : {}),
			draft: body.draft ?? false,
		});

		// Save to history
		const currentBranch = body.sourceBranch;
		const entry: MrHistoryEntry = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			createdAt: new Date().toISOString().slice(0, 10),
			projectPath: "",
			projectId: body.projectId,
			projectName: "",
			sourceBranch: currentBranch,
			targetBranch: body.targetBranch,
			title: body.title,
			mrUrl: result.mrUrl,
			mrIid: result.mrIid,
			labels: undefined,
			draft: body.draft,
			reviewerId: body.assigneeId,
			ticketKeys: [],
		};
		mrStore.add(entry, dedupKey);

		return c.json({
			success: true,
			mrUrl: result.mrUrl,
			mrIid: result.mrIid,
			existing: result.existing,
		});
	} catch (e: unknown) {
		return c.json(
			{
				error: translateApiError(e, "gitlabMR"),
				detail: e instanceof Error ? e.message : String(e),
			},
			500,
		);
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

// ── Jira transitions ──

router.get("/api/jira/transitions", async (c) => {
	const key = c.req.query("key");
	if (!key) {
		return c.json({ error: t("error.keyRequired") }, 400);
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

// ── History ──

router.get("/api/history", (c) => {
	return c.json(mrStore.getAll());
});

router.post("/api/history", async (c) => {
	const entry = await c.req.json<MrHistoryEntry>();
	mrStore.add(entry, dedupKey);
	return c.json({ success: true });
});

router.delete("/api/history", (c) => {
	mrStore.clear();
	return c.json({ success: true });
});

// ── History re-execute ──

router.post("/api/history/:id/execute", async (c) => {
	const id = c.req.param("id");
	const entries = mrStore.getAll();
	const entry = entries.find((e) => e.id === id);
	if (!entry) {
		return c.json({ error: t("error.historyNotFound") }, 404);
	}

	try {
		const gitlab = new GitlabController();
		const result = await createMrWithFallback(gitlab, {
			projectId: entry.projectId,
			sourceBranch: entry.sourceBranch,
			targetBranch: entry.targetBranch,
			title: entry.title,
			description: "",
			...(entry.reviewerId ? { assigneeId: entry.reviewerId } : {}),
			draft: entry.draft ?? false,
		});

		// Update history entry with result
		const updated: MrHistoryEntry = {
			...entry,
			mrUrl: result.mrUrl,
			mrIid: result.mrIid,
		};
		mrStore.add(updated, dedupKey);

		return c.json({
			success: true,
			mrUrl: result.mrUrl,
			mrIid: result.mrIid,
			existing: result.existing,
		});
	} catch (e: unknown) {
		return c.json(
			{
				error: translateApiError(e, "gitlabMR"),
				detail: e instanceof Error ? e.message : String(e),
			},
			500,
		);
	}
});

// Module-level side-effect registration to prevent rolldown tree-shaking.
const _handlers = [
	isGitRepo,
	getCurrentBranch,
	getLocalBranches,
	getReflogSourceBranch,
	gitPush,
	hasGitRemoteOrigin,
	getGitRemoteUrl,
	extractProjectPath,
	extractTicketKeys,
	getCommitMessagesSince,
	GitlabController,
	JiraController,
	translateApiError,
	createMrWithFallback,
	resolveProjectFromRemote,
	generateMrDescription,
	mrStore,
	dedupKey,
];

export { _handlers };
export const mrRoutes = router;
