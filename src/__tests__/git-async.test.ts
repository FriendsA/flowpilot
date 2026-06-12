import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
	execFile: execFileMock,
	execFileSync: vi.fn(),
}));

describe("async git helpers", () => {
	beforeEach(() => {
		vi.resetModules();
		execFileMock.mockReset();
	});

	it("gitFetchAsync returns before the git process callback completes", async () => {
		let callbackCompleted = false;
		execFileMock.mockImplementation((_bin, _args, _opts, cb) => {
			setTimeout(() => {
				callbackCompleted = true;
				cb(null, "", "");
			}, 10);
		});

		const { gitFetchAsync } = await import("../utils/git");
		const promise = gitFetchAsync("origin", "main");

		expect(callbackCompleted).toBe(false);
		await promise;
		expect(callbackCompleted).toBe(true);
		expect(execFileMock).toHaveBeenCalledWith(
			"git",
			["fetch", "origin", "main"],
			expect.objectContaining({ encoding: "utf-8" }),
			expect.any(Function),
		);
	});

	it("gitRebaseAsync checks conflict status when rebase fails", async () => {
		execFileMock
			.mockImplementationOnce((_bin, _args, _opts, cb) =>
				cb(new Error("conflict"), "", ""),
			)
			.mockImplementationOnce((_bin, _args, _opts, cb) =>
				cb(null, "UU file.ts\n", ""),
			);

		const { gitRebaseAsync } = await import("../utils/git");
		const result = await gitRebaseAsync("origin/main");

		expect(result).toBe(false);
		expect(execFileMock).toHaveBeenNthCalledWith(
			1,
			"git",
			["rebase", "origin/main"],
			expect.any(Object),
			expect.any(Function),
		);
		expect(execFileMock).toHaveBeenNthCalledWith(
			2,
			"git",
			["status", "--porcelain"],
			expect.any(Object),
			expect.any(Function),
		);
	});

	it("getCommitMessagesSinceAsync returns commit subjects", async () => {
		execFileMock.mockImplementation((_bin, _args, _opts, cb) =>
			cb(null, "ABC-1 first\nABC-2 second", ""),
		);

		const { getCommitMessagesSinceAsync } = await import("../utils/git");
		const result = await getCommitMessagesSinceAsync("origin/main");

		expect(result).toEqual(["ABC-1 first", "ABC-2 second"]);
		expect(execFileMock).toHaveBeenCalledWith(
			"git",
			["log", "origin/main..HEAD", "--pretty=format:%s"],
			expect.any(Object),
			expect.any(Function),
		);
	});
});
