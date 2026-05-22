import { GitlabController } from "../gitlab-controller";
import { JiraController } from "../jira-controller";
import { extractProjectPath, getGitRemoteUrl, hasGitRemoteOrigin } from "./git";

export type CreateMrOptions = {
	projectId: number;
	sourceBranch: string;
	targetBranch: string;
	title: string;
	description?: string;
	labels?: string;
	assigneeId?: number;
	milestoneId?: number;
	removeSourceBranch?: boolean;
	draft?: boolean;
};

export type CreateMrResult = {
	mrUrl: string;
	mrIid: number | undefined;
	sourceBranch: string;
	targetBranch: string;
	title: string;
	existing: boolean;
};

/**
 * Create MR with "already exists" fallback.
 * If a new MR creation fails because one already exists for the same
 * source→target pair, finds and returns the existing MR URL.
 */
export async function createMrWithFallback(
	gitlab: GitlabController,
	options: CreateMrOptions,
): Promise<CreateMrResult> {
	try {
		const mr = await gitlab.createMergeRequest(
			options.projectId,
			options.sourceBranch,
			options.targetBranch,
			options.title,
			{
				description: options.description ?? "",
				...(options.labels ? { labels: options.labels } : {}),
				...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
				...(options.milestoneId ? { milestoneId: options.milestoneId } : {}),
				...(options.removeSourceBranch !== undefined ? { removeSourceBranch: options.removeSourceBranch } : {}),
				...(options.draft !== undefined ? { draft: options.draft } : {}),
			},
		);
		const mrUrl = (mr.webUrl ?? mr.web_url) as string;
		return {
			mrUrl,
			mrIid: mr.iid as number | undefined,
			sourceBranch: options.sourceBranch,
			targetBranch: options.targetBranch,
			title: options.title,
			existing: false,
		};
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (!msg.includes("already exists")) throw e;

		// Fallback: find existing open MR with matching source/target
		const existingMrs = (await gitlab.listMergeRequests({
			projectId: options.projectId,
			state: "opened",
		})) as unknown as Array<{
			sourceBranch: string;
			targetBranch: string;
			webUrl?: string;
			web_url?: string;
			iid?: number;
		}>;

		const existing = existingMrs.find(
			(m) =>
				m.sourceBranch === options.sourceBranch &&
				m.targetBranch === options.targetBranch,
		);

		if (existing) {
			return {
				mrUrl: existing.webUrl ?? existing.web_url ?? "",
				mrIid: existing.iid,
				sourceBranch: options.sourceBranch,
				targetBranch: options.targetBranch,
				title: options.title,
				existing: true,
			};
		}

		throw e;
	}
}

/**
 * Resolve GitLab project from the git remote origin URL.
 * Returns project info or throws if resolution fails.
 */
export async function resolveProjectFromRemote(
	gitlab: GitlabController,
	opts?: { cwd?: string },
) {
	if (!hasGitRemoteOrigin(opts)) {
		throw new Error("No git remote 'origin' found.");
	}
	const remoteUrl = getGitRemoteUrl(opts);
	const projectPath = extractProjectPath(remoteUrl);
	const project = await gitlab.getProject(projectPath);
	return project;
}

/**
 * Generate MR description from Jira ticket summaries + commit messages.
 */
export async function generateMrDescription(
	jira: JiraController,
	ticketKeys: string[],
	commitMessages: string[],
): Promise<string> {
	if (ticketKeys.length === 0) {
		return commitMessages.join("\n") || "No linked tickets";
	}

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

	if (validIssues.length > 0) {
		return validIssues
			.map((i) => `- ${i.key} ${i.fields.summary}`)
			.join("\n");
	}

	return ticketKeys.join(", ");
}