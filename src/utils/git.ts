import { execFile, execFileSync } from "node:child_process";

type GitOpts = { cwd?: string | undefined };

const resolveCwd = (opts?: GitOpts): string | undefined =>
	opts?.cwd || undefined;

const execGitFile = (
	args: string[],
	opts?: GitOpts,
): Promise<{ stdout: string; stderr: string }> =>
	new Promise((resolve, reject) => {
		execFile(
			"git",
			args,
			{ encoding: "utf-8", cwd: resolveCwd(opts), maxBuffer: 10 * 1024 * 1024 },
			(error, stdout, stderr) => {
				if (error) {
					reject(error);
					return;
				}
				resolve({ stdout, stderr });
			},
		);
	});

export function isGitRepo(opts?: GitOpts): boolean {
	try {
		execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
			stdio: "pipe",
			cwd: resolveCwd(opts),
		});
		return true;
	} catch {
		return false;
	}
}

export function hasGitRemoteOrigin(opts?: GitOpts): boolean {
	try {
		execFileSync("git", ["remote", "get-url", "origin"], {
			stdio: "pipe",
			cwd: resolveCwd(opts),
		});
		return true;
	} catch {
		return false;
	}
}

export function getGitRemoteUrl(opts?: GitOpts): string {
	try {
		return execFileSync("git", ["remote", "get-url", "origin"], {
			encoding: "utf-8",
			cwd: resolveCwd(opts),
		}).trim();
	} catch {
		throw new Error("No git remote 'origin' found in this repository.");
	}
}

export function extractProjectPath(remoteUrl: string): string {
	const cleaned = remoteUrl.replace(/\.git$/, "").replace(/\/+$/, "");

	const sshMatch = cleaned.match(/^git@[^:]+:(.+)$/);
	if (sshMatch?.[1]) return sshMatch[1];

	const httpsMatch = cleaned.match(/^https?:\/\/[^/]+\/(.+)$/);
	if (httpsMatch?.[1]) return httpsMatch[1];

	throw new Error(`Cannot extract project path from remote URL: ${remoteUrl}`);
}

// ── End command utilities ──

export function getCurrentBranch(opts?: GitOpts): string {
	return execFileSync("git", ["branch", "--show-current"], {
		encoding: "utf-8",
		cwd: resolveCwd(opts),
	}).trim();
}

export function getReflogSourceBranch(
	currentBranch: string,
	opts?: GitOpts,
): string | null {
	try {
		const reflog = execFileSync("git", ["reflog", "--date=local"], {
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
			cwd: resolveCwd(opts),
		});
		const escaped = currentBranch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = `checkout: moving from (.*) to ${escaped}`;
		const lines = reflog.split("\n");
		let result: RegExpExecArray | null = null;
		for (const line of lines) {
			const match = new RegExp(pattern).exec(line);
			if (match) result = match;
		}
		return result?.[1] ?? null;
	} catch {
		return null;
	}
}

export function getLocalBranches(opts?: GitOpts): string[] {
	try {
		const output = execFileSync("git", ["branch", "--list"], {
			encoding: "utf-8",
			cwd: resolveCwd(opts),
		});
		return output
			.split("\n")
			.map((l) => l.replace(/^\*?\s+/, "").trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

export function gitFetch(remote: string, branch: string, opts?: GitOpts): void {
	execFileSync("git", ["fetch", remote, branch], {
		stdio: "pipe",
		cwd: resolveCwd(opts),
	});
}

export async function gitFetchAsync(
	remote: string,
	branch: string,
	opts?: GitOpts,
): Promise<void> {
	await execGitFile(["fetch", remote, branch], opts);
}

export function gitRebase(branch: string, opts?: GitOpts): boolean {
	try {
		execFileSync("git", ["rebase", branch], {
			stdio: "pipe",
			cwd: resolveCwd(opts),
		});
		return true;
	} catch {
		try {
			const status = execFileSync("git", ["status", "--porcelain"], {
				encoding: "utf-8",
				cwd: resolveCwd(opts),
			});
			return !status
				.split("\n")
				.some(
					(l) => l.startsWith("UU") || l.startsWith("AA") || l.startsWith("DU"),
				);
		} catch {
			return false;
		}
	}
}

export async function gitRebaseAsync(
	branch: string,
	opts?: GitOpts,
): Promise<boolean> {
	try {
		await execGitFile(["rebase", branch], opts);
		return true;
	} catch {
		try {
			const { stdout } = await execGitFile(["status", "--porcelain"], opts);
			return !stdout
				.split("\n")
				.some(
					(l) => l.startsWith("UU") || l.startsWith("AA") || l.startsWith("DU"),
				);
		} catch {
			return false;
		}
	}
}

export function gitPush(remote: string, branch: string, opts?: GitOpts): void {
	execFileSync("git", ["push", remote, branch], {
		stdio: "pipe",
		cwd: resolveCwd(opts),
	});
}

export async function gitPushAsync(
	remote: string,
	branch: string,
	opts?: GitOpts,
): Promise<void> {
	await execGitFile(["push", remote, branch], opts);
}

export function getCommitMessagesSince(
	baseRef: string,
	opts?: GitOpts,
): string[] {
	try {
		const output = execFileSync(
			"git",
			["log", `${baseRef}..HEAD`, "--pretty=format:%s"],
			{
				encoding: "utf-8",
				cwd: resolveCwd(opts),
			},
		);
		return output.split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

export async function getCommitMessagesSinceAsync(
	baseRef: string,
	opts?: GitOpts,
): Promise<string[]> {
	try {
		const { stdout } = await execGitFile(
			["log", `${baseRef}..HEAD`, "--pretty=format:%s"],
			opts,
		);
		return stdout.split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

export function extractTicketKeys(messages: string[]): string[] {
	const keys = messages
		.map((msg) => msg.split(" ")[0] ?? "")
		.filter((key) => /^[A-Z][A-Z0_-]+-\d+$/i.test(key));
	return [...new Set(keys)];
}
