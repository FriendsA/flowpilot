import { ConfigJson } from "./config";
import { t } from "./i18n/cli";

export interface JenkinsBuild {
	number: number;
	url: string;
	result: string | null;
	building: boolean;
	duration: number;
	timestamp: number;
	displayName?: string;
}

export class JenkinsController {
	private host: string;
	private auth: string;
	private crumb: string | null = null;
	private crumbHeaderName: string | null = null;

	constructor() {
		const config = new ConfigJson();
		const host = config.get("jenkinsHost");
		const user = config.get("jenkinsUser");
		const password = config.get("jenkinsPassword");

		if (!host) {
			throw new Error(t("error.jenkinsHostMissing"));
		}

		if (!user || !password) {
			throw new Error(t("error.jenkinsCredentialsMissing"));
		}

		this.host = /^https?:\/\//.test(host) ? host : `https://${host}`;
		this.auth = Buffer.from(`${user}:${password}`).toString("base64");
	}

	private async fetchCrumb(): Promise<void> {
		try {
			const res = await fetch(`${this.host}/crumbIssuer/api/json`, {
				headers: {
					Authorization: `Basic ${this.auth}`,
					Accept: "application/json",
				},
			});
			if (res.ok) {
				const data = (await res.json()) as {
					crumb: string;
					crumbRequestField: string;
				};
				this.crumb = data.crumb;
				this.crumbHeaderName = data.crumbRequestField;
			}
		} catch {
			// CSRF not enabled — proceed without crumb
		}
	}

	private async request<T>(path: string, init?: RequestInit): Promise<T> {
		const headers: Record<string, string> = {
			Authorization: `Basic ${this.auth}`,
			Accept: "application/json",
			"Content-Type": "application/json",
		};

		// POST requests need crumb for CSRF protection
		if (init?.method === "POST" && this.crumb && this.crumbHeaderName) {
			headers[this.crumbHeaderName] = this.crumb;
		}

		const res = await fetch(`${this.host}${path}`, {
			...init,
			headers: {
				...headers,
				...((init?.headers as Record<string, string>) ?? {}),
			},
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Jenkins API ${res.status}: ${body}`);
		}

		if (res.status === 204 || res.headers.get("content-length") === "0") {
			return undefined as T;
		}

		return res.json() as Promise<T>;
	}

	private async requestText(path: string): Promise<string> {
		const res = await fetch(`${this.host}${path}`, {
			headers: {
				Authorization: `Basic ${this.auth}`,
			},
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Jenkins API ${res.status}: ${body}`);
		}

		return res.text();
	}

	private async ensureCrumb(): Promise<void> {
		if (!this.crumb) {
			await this.fetchCrumb();
		}
	}

	// ── Build Operations ────────────────────────────────────────

	/** Trigger a build for a job (non-parameterized). */
	async triggerBuild(jobName: string): Promise<void> {
		await this.ensureCrumb();
		await this.request<void>(`/job/${encodeURIComponent(jobName)}/build`, {
			method: "POST",
		});
	}

	/** Trigger a parameterized build. */
	async triggerBuildWithParameters(
		jobName: string,
		params: Record<string, string>,
	): Promise<void> {
		await this.ensureCrumb();
		const query = Object.entries(params)
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join("&");
		await this.request<void>(
			`/job/${encodeURIComponent(jobName)}/buildWithParameters?${query}`,
			{ method: "POST" },
		);
	}

	// ── Build Status ────────────────────────────────────────────

	/** Get build status by job name and build number. */
	async getBuildStatus(
		jobName: string,
		buildNumber: number,
	): Promise<JenkinsBuild> {
		return this.request<JenkinsBuild>(
			`/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`,
		);
	}

	/** Get the last build number for a job. */
	async getLastBuildNumber(jobName: string): Promise<number | null> {
		const data = await this.request<{
			lastBuild: { number: number } | null;
		}>(`/job/${encodeURIComponent(jobName)}/api/json?tree=lastBuild[number]`);
		return data.lastBuild?.number ?? null;
	}

	// ── Job Search ──────────────────────────────────────────────

	/** List all jobs (name, url, color). */
	async listJobs(): Promise<JenkinsJob[]> {
		const data = await this.request<{ jobs: JenkinsJob[] }>(
			"/api/json?tree=jobs[name,url,color,fullName]",
		);
		return data.jobs ?? [];
	}

	// ── Build Info (with artifacts) ─────────────────────────────

	/** Get build info including artifacts. */
	async getBuildInfo(
		jobName: string,
		buildNumber: number,
	): Promise<JenkinsBuildWithArtifacts> {
		return this.request<JenkinsBuildWithArtifacts>(
			`/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json?tree=number,url,result,building,duration,timestamp,displayName,artifacts[fileName,relativePath]`,
		);
	}

	/** Get last build (full info with artifacts). */
	async getLastBuild(
		jobName: string,
	): Promise<JenkinsBuildWithArtifacts | null> {
		const buildNumber = await this.getLastBuildNumber(jobName);
		if (buildNumber === null) return null;
		return this.getBuildInfo(jobName, buildNumber);
	}

	// ── Build Log ───────────────────────────────────────────────

	/** Get build console log as plain text. */
	async getBuildLog(jobName: string, buildNumber: number): Promise<string> {
		return this.requestText(
			`/job/${encodeURIComponent(jobName)}/${buildNumber}/consoleText`,
		);
	}
}

export interface JenkinsJob {
	name: string;
	url: string;
	color: string;
	fullName?: string;
}

export interface JenkinsBuildWithArtifacts extends JenkinsBuild {
	artifacts?: JenkinsArtifact[];
}

export interface JenkinsArtifact {
	fileName: string;
	relativePath: string;
}
