import { cleanVersion } from "./pom";

/**
 * Build the release artifact name used as both Jira version name
 * and the prefix for the issue summary.
 */
export function buildVersionName(
	flowPilotName: string | null | undefined,
	version: string | null | undefined,
): string {
	return `${flowPilotName ?? ""}-${cleanVersion(version ?? null)}`;
}

/**
 * Build the Jira issue summary for a release request.
 * Centralized here so CLI and Web agree on the exact string —
 * otherwise re-running a release would not find the existing issue
 * via JQL `summary ~` and would create duplicates.
 */
export function buildReleaseSummary(
	flowPilotName: string | null | undefined,
	version: string | null | undefined,
	suffix: string,
): string {
	return `${buildVersionName(flowPilotName, version)} ${suffix}`;
}

/**
 * Escape a user-supplied string for inclusion inside a JQL
 * double-quoted literal. Replaces embedded `"` and `\` to keep the
 * query syntactically valid.
 */
export function escapeJqlStringLiteral(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
