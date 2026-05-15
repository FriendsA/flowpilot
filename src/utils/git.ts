import { execSync } from "node:child_process";

export function isGitRepo(): boolean {
	try {
		execSync("git rev-parse --is-inside-work-tree", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

export function hasGitRemoteOrigin(): boolean {
	try {
		execSync("git remote get-url origin", { stdio: "pipe" });
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

// ── End command utilities ──

export function getCurrentBranch(): string {
	return execSync("git branch --show-current", { encoding: "utf-8" }).trim();
}

export function getReflogSourceBranch(currentBranch: string): string | null {
	try {
		const reflog = execSync("git reflog --date=local", { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
		const reg = new RegExp(`checkout: moving from (.*) to ${currentBranch}`, "g");
		const lines = reflog.split("\n").filter((x) => reg.test(x));
		if (lines.length === 0) return null;
		const result = new RegExp(`checkout: moving from (.*) to ${currentBranch}`).exec(lines[lines.length - 1]!);
		return result?.[1] ?? null;
	} catch {
		return null;
	}
}

export function getLocalBranches(): string[] {
	try {
		const output = execSync("git branch --list", { encoding: "utf-8" });
		return output
			.split("\n")
			.map((l) => l.replace(/^\*?\s+/, "").trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

export function gitFetch(remote: string, branch: string): void {
	execSync(`git fetch ${remote} ${branch}:${branch}`, { stdio: "pipe" });
}

export function gitRebase(branch: string): boolean {
	try {
		execSync(`git rebase ${branch}`, { stdio: "pipe" });
		return true;
	} catch {
		// Check if there are conflicts
		try {
			const status = execSync("git status --porcelain", { encoding: "utf-8" });
			return !status.split("\n").some((l) => l.startsWith("UU") || l.startsWith("AA") || l.startsWith("DU"));
		} catch {
			return false;
		}
	}
}

export function gitPush(remote: string, branch: string): void {
	execSync(`git push ${remote} ${branch}`, { stdio: "pipe" });
}

export function getCommitMessagesSince(baseRef: string): string[] {
	try {
		const output = execSync(`git log ${baseRef}..HEAD --pretty=format:%s`, { encoding: "utf-8" });
		return output.split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

export function extractTicketKeys(messages: string[]): string[] {
	const keys = messages
		.map((msg) => (msg.split(" ")[0] ?? ""))
		.filter((key) => /^[A-Z][A-Z0_-]+-\d+$/i.test(key));
	return [...new Set(keys)];
}