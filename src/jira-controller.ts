import { ConfigJson } from "./config";
import { t } from "./i18n/cli";

export interface JiraIssue {
	key: string;
	fields: {
		summary: string;
		status: { name: string };
		assignee?: { displayName: string };
		issuetype: { name: string };
		priority?: { name: string };
		created: string;
		updated: string;
	};
}

export interface JiraSearchResult {
	total: number;
	issues: JiraIssue[];
}

export class JiraController {
	private host: string;
	private auth: string;

	constructor() {
		const config = new ConfigJson();
		const host = config.get("jiraHost");
		const name = config.get("jiraName");
		const password = config.get("jiraPassword");

		if (!host) {
			throw new Error(t("error.jiraHostMissing"));
		}

		if (!name || !password) {
			throw new Error(t("error.jiraCredentialsMissing"));
		}

		this.host = host;
		this.auth = Buffer.from(`${name}:${password}`).toString("base64");
	}

	private async request<T>(path: string, init?: RequestInit): Promise<T> {
		const res = await fetch(`${this.host}${path}`, {
			...init,
			headers: {
				Authorization: `Basic ${this.auth}`,
				"Content-Type": "application/json",
				Accept: "application/json",
				...init?.headers,
			},
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Jira API ${res.status}: ${body}`);
		}

		return res.json() as Promise<T>;
	}

	/** Get current user info. Useful to verify credentials. */
	myself() {
		return this.request<{ displayName: string; emailAddress: string }>(
			"/rest/api/2/myself",
		);
	}

	/** Search issues with JQL. */
	search(jql: string, maxResults = 50) {
		return this.request<JiraSearchResult>(
			`/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`,
		);
	}

	/** Get a single issue by key (e.g. "PROJ-123"). */
	getIssue(key: string) {
		return this.request<JiraIssue>(`/rest/api/2/issue/${key}`);
	}

	/** Get available transitions for an issue. */
	getTransitions(key: string) {
		return this.request<{
			transitions: { id: string; name: string }[];
		}>(`/rest/api/2/issue/${key}/transitions`);
	}

	/** Transition an issue to a new status. */
	transitionIssue(key: string, transitionId: string) {
		return this.request<void>(`/rest/api/2/issue/${key}/transitions`, {
			method: "POST",
			body: JSON.stringify({ transition: { id: transitionId } }),
		});
	}

	/** Add a comment to an issue. */
	addComment(key: string, body: string) {
		return this.request<{ id: string }>(`/rest/api/2/issue/${key}/comment`, {
			method: "POST",
			body: JSON.stringify({ body }),
		});
	}

	/** List all versions for a project. */
	getProjectVersions(projectKey: string) {
		return this.request<
			{
				id: string;
				name: string;
				archived: boolean;
				released: boolean;
				releaseDate?: string;
			}[]
		>(`/rest/api/2/project/${projectKey}/versions`);
	}

	/** Create a new version in a project. */
	createVersion(projectKey: string, name: string) {
		return this.request<{ id: string; name: string }>("/rest/api/2/version", {
			method: "POST",
			body: JSON.stringify({ name, project: projectKey }),
		});
	}

	/** Create an issue with arbitrary fields. */
	createIssue(fields: Record<string, unknown>) {
		return this.request<{ id: string; key: string }>("/rest/api/2/issue", {
			method: "POST",
			body: JSON.stringify({ fields }),
		});
	}

	/** List all accessible projects, returning only key and id. */
	listProjectKeys() {
		return this.request<{ key: string; id: string }[]>("/rest/api/2/project");
	}
}