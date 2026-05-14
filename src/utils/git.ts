import { execSync } from "node:child_process";

export function isGitRepo(): boolean {
	try {
		execSync("git rev-parse --is-inside-work-tree", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

export function getGitRemoteUrl(): string {
	try {
		return execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
	} catch {
		throw new Error("No git remote 'origin' found in this repository.");
	}
}

export function extractProjectPath(remoteUrl: string): string {
	let cleaned = remoteUrl.replace(/\.git$/, "").replace(/\/+$/, "");

	const sshMatch = cleaned.match(/^git@[^:]+:(.+)$/);
	if (sshMatch) return sshMatch[1]!;

	const httpsMatch = cleaned.match(/^https?:\/\/[^\/]+\/(.+)$/);
	if (httpsMatch) return httpsMatch[1]!;

	throw new Error(`Cannot extract project path from remote URL: ${remoteUrl}`);
}