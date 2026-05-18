import { Hono } from "hono";
import { ConfigJson } from "../../config";
import { GitlabController } from "../../gitlab-controller";
import { translateApiError } from "../../i18n/translate-error";
import { t } from "../../i18n/web";
import { JiraController } from "../../jira-controller";
import type { Config } from "../../types";
import {
	extractProjectPath,
	extractTicketKeys,
	getCommitMessagesSince,
	getCurrentBranch,
	getGitRemoteUrl,
	getLocalBranches,
	getReflogSourceBranch,
	gitFetch,
	gitPush,
	gitRebase,
	hasGitRemoteOrigin,
	isGitRepo,
} from "../../utils/git";

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
		title: t("web.endTitle"),
	});
});

// ── Git status ──

router.get("/api/git/status", (c) => {
	if (!isGitRepo()) {
		return c.json({ error: t("end.notGitRepo") }, 400);
	}
	try {
		const currentBranch = getCurrentBranch();
		const localBranches = getLocalBranches();
		const detectedSource = getReflogSourceBranch(currentBranch);
		return c.json({ currentBranch, localBranches, detectedSource });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Rebase ──

router.post("/api/rebase", async (c) => {
	const { targetBranch } = await c.req.json<{ targetBranch: string }>();
	if (!targetBranch) {
		return c.json({ error: "targetBranch is required" }, 400);
	}
	try {
		gitFetch("origin", targetBranch);
		const ok = gitRebase(`origin/${targetBranch}`);
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
	const { branch } = await c.req.json<{ branch: string }>();
	if (!branch) {
		return c.json({ error: "branch is required" }, 400);
	}
	try {
		gitPush("origin", branch);
		return c.json({ success: true });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Commits / ticket keys ──

router.get("/api/commits", (c) => {
	const baseRef = c.req.query("base");
	if (!baseRef) {
		return c.json({ error: "base query param is required" }, 400);
	}
	try {
		const messages = getCommitMessagesSince(`origin/${baseRef}`);
		const ticketKeys = extractTicketKeys(messages);
		return c.json({ messages, ticketKeys });
	} catch (e: unknown) {
		return c.json({ error: translateApiError(e) }, 500);
	}
});

// ── Create MR ──

router.post("/api/create-mr", async (c) => {
	const { currentBranch, targetBranch, ticketKeys } = await c.req.json<{
		currentBranch: string;
		targetBranch: string;
		ticketKeys: string[];
	}>();

	if (!hasGitRemoteOrigin()) {
		return c.json({ error: t("end.noRemote") }, 400);
	}

	try {
		const gitlab = new GitlabController();
		const jira = new JiraController();

		const remoteUrl = getGitRemoteUrl();
		const projectPath = extractProjectPath(remoteUrl);
		const project = await gitlab.getProject(projectPath);

		const issues = await Promise.all(
			ticketKeys.map(async (key) => {
				try {
					return await jira.getIssue(key);
				} catch {
					return null;
				}
			}),
		);
		const validIssues = issues.filter(
			(i): i is NonNullable<typeof i> => i !== null,
		);
		const description =
			validIssues.length > 0
				? validIssues.map((i) => `- ${i.key} ${i.fields.summary}`).join("\n")
				: ticketKeys.length > 0
					? ticketKeys.join(", ")
					: "No linked tickets";

		const mr = await gitlab.createMergeRequest(
			project.id as number,
			currentBranch,
			targetBranch,
			`${currentBranch} → ${targetBranch}`,
			{ description },
		);

		const mrUrl = (mr.webUrl ?? mr.web_url) as string;
		return c.json({ success: true, mrUrl, mrIid: mr.iid });
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
// Hono router .get()/.post() calls are side effects that bundlers may
// incorrectly strip as "unused" chain calls. By collecting references to
// the handler functions and exporting them, the bundler must preserve
// the entire module because these symbols are reachable.
const _handlers = [
	isGitRepo,
	getCurrentBranch,
	getLocalBranches,
	getReflogSourceBranch,
	gitFetch,
	gitRebase,
	gitPush,
	getGitRemoteUrl,
	extractProjectPath,
	getCommitMessagesSince,
	extractTicketKeys,
	hasGitRemoteOrigin,
	GitlabController,
	JiraController,
	translateApiError,
];

export { _handlers };
export const endRoutes = router;