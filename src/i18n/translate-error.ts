import { t } from "./cli";

type ErrorContext =
	| "gitlabProject"
	| "gitlabBranch"
	| "gitlabFile"
	| "gitlabGeneral"
	| "gitlabMR"
	| "jiraProject"
	| "jiraSearch"
	| "jiraVersion"
	| "jiraCreateIssue"
	| "jiraGeneral"
	| "jenkinsSearch"
	| "jenkinsBuild"
	| "network";

const HTTP_CODE_MAP: Record<string, string> = {
	"401": "error.http401",
	"403": "error.http403",
	"404": "error.http404",
	"500": "error.http500",
};

const CONTEXT_404_MAP: Record<ErrorContext, string> = {
	gitlabProject: "error.http404Project",
	gitlabFile: "error.http404File",
	gitlabBranch: "error.http404",
	gitlabGeneral: "error.http404",
	gitlabMR: "error.http404",
	jiraProject: "error.http404",
	jiraSearch: "error.http404",
	jiraVersion: "error.http404",
	jiraCreateIssue: "error.http404",
	jiraGeneral: "error.http404",
	jenkinsSearch: "error.http404",
	jenkinsBuild: "error.noBuild",
	network: "error.network",
};

const CONTEXT_FALLBACK_MAP: Record<ErrorContext, string> = {
	gitlabProject: "error.fetchProjectsFailed",
	gitlabBranch: "error.fetchBranchesFailed",
	gitlabFile: "error.fetchPomFailed",
	gitlabGeneral: "error.gitlabApiFailed",
	gitlabMR: "error.gitlabApiFailed",
	jiraProject: "error.fetchJiraProjectsFailed",
	jiraSearch: "error.jiraSearchFailed",
	jiraVersion: "error.jiraVersionFailed",
	jiraCreateIssue: "error.jiraCreateIssueFailed",
	jiraGeneral: "error.gitlabApiFailed",
	jenkinsSearch: "error.jenkinsSearchFailed",
	jenkinsBuild: "error.jenkinsBuildFailed",
	network: "error.network",
};

function extractHttpStatus(msg: string): string | null {
	const match = msg.match(/\b(401|403|404|500)\b/);
	return match?.[1] ?? null;
}

function isNetworkError(msg: string): boolean {
	return (
		msg.includes("ECONNREFUSED") ||
		msg.includes("ENOTFOUND") ||
		msg.includes("ETIMEDOUT") ||
		msg.includes("fetch failed") ||
		msg.includes("Network Error") ||
		msg.includes("request failed")
	);
}

export function translateApiError(
	raw: unknown,
	context: ErrorContext = "gitlabGeneral",
): string {
	const msg = raw instanceof Error ? raw.message : String(raw);

	if (isNetworkError(msg)) {
		return t("error.network");
	}

	const httpStatus = extractHttpStatus(msg);
	if (httpStatus === "404") {
		return t(CONTEXT_404_MAP[context]);
	}
	if (httpStatus && HTTP_CODE_MAP[httpStatus]) {
		return t(HTTP_CODE_MAP[httpStatus]);
	}

	// Context-specific fallback
	return t(CONTEXT_FALLBACK_MAP[context]);
}
