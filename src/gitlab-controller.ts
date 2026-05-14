import { Gitlab } from "@gitbeaker/rest";
import { ConfigJson } from "./config";

type MrState = "opened" | "closed" | "locked" | "merged";

export class GitlabController {
	private api: Gitlab<true>;

	constructor() {
		const config = new ConfigJson();
		const host = config.get("gitlabHost");
		const token = config.get("gitlabKey");

		if (!host) {
			throw new Error(
				"GitLab host not configured. Run `flowpilot config` first.",
			);
		}

		if (!token) {
			throw new Error(
				"GitLab token not configured. Run `flowpilot config` first.",
			);
		}

		this.api = new Gitlab({
			host: /^https?:\/\//.test(host) ? host : `http://${host}`,
			token,
			camelize: true,
		});
	}

	/** Get current authenticated user info. */
	currentUser() {
		return this.api.Users.showCurrentUser();
	}

	// ── Projects ──────────────────────────────────────────────

	/** Search projects by name. */
	searchProjects(query: string) {
		return this.api.Projects.search(query);
	}

	/** Get project by ID or path (e.g. "group/project"). */
	getProject(id: string | number) {
		return this.api.Projects.show(id);
	}

	/** List all projects with optional filters. */
	listProjects(options?: Record<string, unknown>) {
		return this.api.Projects.all(options);
	}

	// ── Merge Requests ────────────────────────────────────────

	/** List MRs with optional filters. */
	listMergeRequests(options?: {
		projectId?: string | number;
		groupId?: string | number;
		state?: MrState;
		labels?: string;
		milestone?: string;
	}) {
		const { projectId, groupId, state, labels, milestone } = options ?? {};
		return this.api.MergeRequests.all({
			...(projectId ? { projectId } : groupId ? { groupId } : {}),
			...(state && { state }),
			...(labels && { labels }),
			...(milestone && { milestone }),
		});
	}

	/** Get a single MR. */
	getMergeRequest(projectId: string | number, mrIid: number) {
		return this.api.MergeRequests.show(projectId, mrIid);
	}

	/** Create an MR. */
	createMergeRequest(
		projectId: string | number,
		sourceBranch: string,
		targetBranch: string,
		title: string,
		options?: { description?: string; labels?: string },
	) {
		return this.api.MergeRequests.create(
			projectId,
			sourceBranch,
			targetBranch,
			title,
			options,
		);
	}

	/** Accept / merge an MR. */
	acceptMergeRequest(projectId: string | number, mrIid: number) {
		return this.api.MergeRequests.accept(projectId, mrIid);
	}

	// ── Branches ──────────────────────────────────────────────

	/** List branches for a project. */
	listBranches(projectId: string | number, search?: string) {
		return this.api.Branches.all(projectId, search ? { search } : undefined);
	}

	/** Get branch details. */
	getBranch(projectId: string | number, branch: string) {
		return this.api.Branches.show(projectId, branch);
	}

	/** Create a branch. */
	createBranch(projectId: string | number, branch: string, ref: string) {
		return this.api.Branches.create(projectId, branch, ref);
	}

	/** Delete a branch. */
	deleteBranch(projectId: string | number, branch: string) {
		return this.api.Branches.remove(projectId, branch);
	}

	// ── Issues ────────────────────────────────────────────────

	/** List issues with optional filters. */
	listIssues(options?: {
		projectId?: string | number;
		groupId?: string | number;
		state?: string;
		labels?: string;
	}) {
		const { projectId, groupId, state, labels } = options ?? {};
		return this.api.Issues.all({
			...(projectId ? { projectId } : groupId ? { groupId } : {}),
			...(state && { state }),
			...(labels && { labels }),
		});
	}

	/** Get a single issue by project-scoped IID. */
	getIssue(projectId: string | number, issueIid: number) {
		return this.api.Issues.show(issueIid, { projectId });
	}

	// ── Repositories ──────────────────────────────────────────

	/** List repo files in a path. */
	listTree(
		projectId: string | number,
		options?: { path?: string; ref?: string; recursive?: boolean },
	) {
		return this.api.Repositories.allRepositoryTrees(projectId, options);
	}

	/** Get file content. */
	getFile(projectId: string | number, filePath: string, ref: string) {
		return this.api.RepositoryFiles.show(projectId, filePath, ref);
	}
}