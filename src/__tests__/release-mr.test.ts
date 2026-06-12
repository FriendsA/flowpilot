import { beforeEach, describe, expect, it, vi } from "vitest";
import { releaseRoutes } from "../commands/release/routes";

// Mock i18n/web
vi.mock("../i18n/web", () => ({
	t: (key: string) => key,
	initI18n: vi.fn().mockResolvedValue(undefined),
	detectLocaleFromCookie: vi.fn().mockReturnValue(null),
	detectLocaleFromHeader: vi.fn().mockReturnValue("zh-CN"),
	getLocaleResources: vi.fn().mockReturnValue({ translation: {} }),
}));

// Mock translateApiError
vi.mock("../i18n/translate-error", () => ({
	translateApiError: (raw: unknown) =>
		raw instanceof Error ? raw.message : String(raw),
}));

// Mock Layout
vi.mock("../shared/layout", () => ({
	Layout: ({ children }: { children: string }) => children,
}));

// Mock ConfigJson
const { mockConfigGet, mockConfigGetConfig } = vi.hoisted(() => ({
	mockConfigGet: vi.fn(),
	mockConfigGetConfig: vi.fn(),
}));

vi.mock("../config", () => ({
	ConfigJson: class {
		get = mockConfigGet;
		getConfig = mockConfigGetConfig;
	},
}));

// Mock controllers
const {
	mockGitlabListProjects,
	mockGitlabListBranches,
	mockGitlabGetFile,
	mockGitlabCreateMergeRequest,
	mockGitlabListMergeRequests,
} = vi.hoisted(() => ({
	mockGitlabListProjects: vi.fn(),
	mockGitlabListBranches: vi.fn(),
	mockGitlabGetFile: vi.fn(),
	mockGitlabCreateMergeRequest: vi.fn(),
	mockGitlabListMergeRequests: vi.fn(),
}));

const {
	mockJiraSearch,
	mockJiraGetProjectVersions,
	mockJiraCreateVersion,
	mockJiraCreateIssue,
	mockJiraListProjectKeys,
} = vi.hoisted(() => ({
	mockJiraSearch: vi.fn(),
	mockJiraGetProjectVersions: vi.fn(),
	mockJiraCreateVersion: vi.fn(),
	mockJiraCreateIssue: vi.fn(),
	mockJiraListProjectKeys: vi.fn(),
}));

vi.mock("../gitlab-controller", () => ({
	GitlabController: class {
		listProjects = mockGitlabListProjects;
		listBranches = mockGitlabListBranches;
		getFile = mockGitlabGetFile;
		createMergeRequest = mockGitlabCreateMergeRequest;
		listMergeRequests = mockGitlabListMergeRequests;
	},
}));

vi.mock("../jira-controller", () => ({
	JiraController: class {
		search = mockJiraSearch;
		getProjectVersions = mockJiraGetProjectVersions;
		createVersion = mockJiraCreateVersion;
		createIssue = mockJiraCreateIssue;
		listProjectKeys = mockJiraListProjectKeys;
	},
}));

const app = releaseRoutes;

const POM_XML =
	"<project><groupId>com.ex</groupId><artifactId>app</artifactId><version>1.0</version><properties><releaseName>my-flow-app</releaseName></properties></project>";
const POM_BASE64 = Buffer.from(POM_XML).toString("base64").replace(/\n/g, "");

beforeEach(() => {
	vi.clearAllMocks();
	mockConfigGetConfig.mockReturnValue({
		jiraHost: "https://jira.com",
		jiraName: "user",
		jiraPassword: "pass",
		gitlabHost: "https://gitlab.com",
		gitlabKey: "token",
	});
});

// Helper: insert a history entry before executing
async function seedEntry(
	id: string,
	branch: string,
	jiraProjectKey: string,
	extra?: Record<string, unknown>,
) {
	await app.fetch(
		new Request("http://localhost/api/history", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id,
				projectId: 5,
				projectName: "test-project",
				projectPath: "group/test-project",
				branch,
				jiraProjectKey,
				...extra,
			}),
		}),
	);
}

// ---------------------------------------------------------------------------
// Create MR API
// ---------------------------------------------------------------------------
describe("Release routes – POST /release/api/create-mr", () => {
	it("creates MR and returns mrUrl", async () => {
		mockGitlabCreateMergeRequest.mockResolvedValueOnce({
			webUrl: "https://gitlab.com/project/merge_requests/1",
		});
		const res = await app.fetch(
			new Request("http://localhost/api/create-mr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: "5",
					targetBranch: "release-1.0",
					sourceBranch: "develop",
					jiraUrl: "https://jira.com/browse/PROJ-1",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({
			mrUrl: "https://gitlab.com/project/merge_requests/1",
			sourceBranch: "develop",
			targetBranch: "release-1.0",
		});
		expect(mockGitlabCreateMergeRequest).toHaveBeenCalledWith(
			5,
			"develop",
			"release-1.0",
			"develop → release-1.0",
			{ description: "Jira: https://jira.com/browse/PROJ-1" },
		);
	});

	it("creates MR without Jira description when jiraUrl empty", async () => {
		mockGitlabCreateMergeRequest.mockResolvedValueOnce({
			web_url: "https://gitlab.com/project/merge_requests/2",
		});
		const res = await app.fetch(
			new Request("http://localhost/api/create-mr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: "10",
					targetBranch: "main",
					sourceBranch: "feature-x",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({
			mrUrl: "https://gitlab.com/project/merge_requests/2",
			sourceBranch: "feature-x",
			targetBranch: "main",
		});
		expect(mockGitlabCreateMergeRequest).toHaveBeenCalledWith(
			10,
			"feature-x",
			"main",
			"feature-x → main",
			{ description: "" },
		);
	});

	it("returns error when createMergeRequest fails", async () => {
		mockGitlabCreateMergeRequest.mockRejectedValueOnce(
			new Error("merge conflict"),
		);
		const res = await app.fetch(
			new Request("http://localhost/api/create-mr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: "5",
					targetBranch: "main",
					sourceBranch: "develop",
				}),
			}),
		);
		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data).toEqual({ error: "merge conflict" });
	});

	it("handles web_url field from GitLab API response", async () => {
		mockGitlabCreateMergeRequest.mockResolvedValueOnce({
			web_url: "https://gitlab.com/project/-/merge_requests/3",
		});
		const res = await app.fetch(
			new Request("http://localhost/api/create-mr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: "3",
					targetBranch: "main",
					sourceBranch: "hotfix",
					jiraUrl: "",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({
			mrUrl: "https://gitlab.com/project/-/merge_requests/3",
			sourceBranch: "hotfix",
			targetBranch: "main",
		});
	});

	it("saves mrUrl/mrSourceBranch/mrTargetBranch to history entry after successful MR creation", async () => {
		// First seed a history entry
		await seedEntry("mr-save-test", "release-1.0", "PROJ");

		mockGitlabCreateMergeRequest.mockResolvedValueOnce({
			webUrl: "https://gitlab.com/project/merge_requests/100",
		});

		const res = await app.fetch(
			new Request("http://localhost/api/create-mr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: "5",
					targetBranch: "release-1.0",
					sourceBranch: "develop",
					jiraUrl: "",
				}),
			}),
		);
		expect(res.status).toBe(200);

		// Verify history entry now has MR fields
		const histRes = await app.fetch(
			new Request("http://localhost/api/history"),
		);
		const histData = await histRes.json();
		const entry = histData.find((e: any) => e.id === "mr-save-test");
		expect(entry.mrUrl).toBe("https://gitlab.com/project/merge_requests/100");
		expect(entry.mrSourceBranch).toBe("develop");
		expect(entry.mrTargetBranch).toBe("release-1.0");
	});

	it("finds existing MR via 'already exists' fallback in create-mr endpoint", async () => {
		await seedEntry("mr-exists-test", "develop", "PROJ");

		mockGitlabCreateMergeRequest.mockRejectedValueOnce(
			new Error("Merge request already exists"),
		);
		mockGitlabListMergeRequests.mockResolvedValueOnce([
			{
				sourceBranch: "feature-x",
				targetBranch: "develop",
				webUrl: "https://gitlab.com/project/merge_requests/50",
			},
		]);

		const res = await app.fetch(
			new Request("http://localhost/api/create-mr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: "5",
					targetBranch: "develop",
					sourceBranch: "feature-x",
					jiraUrl: "",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.mrUrl).toBe("https://gitlab.com/project/merge_requests/50");
		expect(data.sourceBranch).toBe("feature-x");
		expect(data.targetBranch).toBe("develop");
	});
});

// ---------------------------------------------------------------------------
// Branches API (used by MR creation flow)
// ---------------------------------------------------------------------------
describe("Release routes – GET /release/api/projects/:id/branches (MR context)", () => {
	it("returns branches for MR source selection", async () => {
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "develop", default: true },
			{ name: "feature-x", default: false },
			{ name: "release-1.0", default: false },
		]);
		const res = await app.fetch(
			new Request("http://localhost/api/projects/5/branches"),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toHaveLength(3);
		expect(data[0]).toEqual({ name: "develop", default: true });
	});

	it("returns empty array when project has no branches", async () => {
		mockGitlabListBranches.mockResolvedValueOnce([]);
		const res = await app.fetch(
			new Request("http://localhost/api/projects/999/branches"),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// History execute API – with MR creation
// ---------------------------------------------------------------------------
describe("Release routes – POST /release/api/history/:id/execute (with MR)", () => {
	it("creates MR when createMr=true and default branch exists", async () => {
		await seedEntry("test-id", "release-1.0", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-1" }],
		});
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "develop", default: true },
			{ name: "release-1.0", default: false },
		]);
		mockGitlabCreateMergeRequest.mockResolvedValueOnce({
			webUrl: "https://gitlab.com/project/merge_requests/1",
		});

		const res = await app.fetch(
			new Request("http://localhost/api/history/test-id/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.issueKey).toBe("PROJ-1");
		expect(data.mrUrl).toBe("https://gitlab.com/project/merge_requests/1");
		expect(data.mrSourceBranch).toBe("develop");
		expect(data.mrTargetBranch).toBe("release-1.0");
	});

	it("skips MR when createMr=false", async () => {
		await seedEntry("test-id-2", "main", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-2" }],
		});

		const res = await app.fetch(
			new Request("http://localhost/api/history/test-id-2/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: false }),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.issueKey).toBe("PROJ-2");
		expect(data.mrUrl).toBeUndefined();
	});

	it("defaults createMr to false when body missing", async () => {
		await seedEntry("test-id-3", "main", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-3" }],
		});

		const res = await app.fetch(
			new Request("http://localhost/api/history/test-id-3/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.mrUrl).toBeUndefined();
	});

	it("returns 404 when history entry not found", async () => {
		const res = await app.fetch(
			new Request("http://localhost/api/history/nonexistent/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);
		expect(res.status).toBe(404);
	});

	it("handles MR creation failure gracefully", async () => {
		await seedEntry("test-id-4", "main", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-4" }],
		});
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "develop", default: true },
		]);
		mockGitlabCreateMergeRequest.mockRejectedValueOnce(
			new Error("MR creation failed"),
		);

		const res = await app.fetch(
			new Request("http://localhost/api/history/test-id-4/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.issueKey).toBe("PROJ-4");
		expect(data.mrUrl).toBeUndefined();
	});

	it("skips MR when default branch equals target branch", async () => {
		await seedEntry("test-id-5", "release-1.0", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-5" }],
		});
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "release-1.0", default: true },
		]);

		const res = await app.fetch(
			new Request("http://localhost/api/history/test-id-5/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.issueKey).toBe("PROJ-5");
		expect(data.mrUrl).toBeUndefined();
	});

	it("does NOT modify history when executing with createMr", async () => {
		await seedEntry("no-mod-test", "main", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-6" }],
		});

		// Get history before execute
		const histBefore = await app.fetch(
			new Request("http://localhost/api/history"),
		);
		const beforeData = await histBefore.json();
		const entryBefore = beforeData.find((e: any) => e.id === "no-mod-test");
		const mrUrlBefore = entryBefore?.mrUrl;

		const res = await app.fetch(
			new Request("http://localhost/api/history/no-mod-test/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: false }),
			}),
		);
		expect(res.status).toBe(200);

		// Verify history unchanged
		const histAfter = await app.fetch(
			new Request("http://localhost/api/history"),
		);
		const afterData = await histAfter.json();
		const entryAfter = afterData.find((e: any) => e.id === "no-mod-test");
		expect(entryAfter.mrUrl).toBe(mrUrlBefore ?? undefined);
	});
});

// ---------------------------------------------------------------------------
// createMrForRelease internal logic tests (via execute endpoint)
// ---------------------------------------------------------------------------
describe("createMrForRelease – branch selection logic", () => {
	it("uses default branch as source when available", async () => {
		await seedEntry("create-mr-default", "release-2.0", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-10" }],
		});
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "develop", default: true },
			{ name: "feature-a", default: false },
			{ name: "release-2.0", default: false },
		]);
		mockGitlabCreateMergeRequest.mockResolvedValueOnce({
			webUrl: "https://gitlab.com/mr/10",
		});

		await app.fetch(
			new Request("http://localhost/api/history/create-mr-default/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);

		expect(mockGitlabCreateMergeRequest).toHaveBeenCalledWith(
			5,
			"develop",
			"release-2.0",
			"develop → release-2.0",
			expect.anything(),
		);
	});

	it("returns undefined when no default branch found", async () => {
		await seedEntry("create-mr-no-default", "main", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-11" }],
		});
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "feature-b", default: false },
		]);

		const res = await app.fetch(
			new Request("http://localhost/api/history/create-mr-no-default/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);
		const data = await res.json();
		expect(data.mrUrl).toBeUndefined();
	});

	it("uses sourceBranchOverride when entry has mrSourceBranch stored", async () => {
		await seedEntry("override-test", "release-3.0", "PROJ", {
			mrUrl: "https://gitlab.com/existing-mr",
			mrSourceBranch: "custom-branch",
			mrTargetBranch: "release-3.0",
		});
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-20" }],
		});
		mockGitlabCreateMergeRequest.mockResolvedValueOnce({
			webUrl: "https://gitlab.com/mr/override",
		});

		const res = await app.fetch(
			new Request("http://localhost/api/history/override-test/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);
		expect(res.status).toBe(200);
		// Should use "custom-branch" (stored mrSourceBranch) instead of default
		expect(mockGitlabCreateMergeRequest).toHaveBeenCalledWith(
			5,
			"custom-branch",
			"release-3.0",
			"custom-branch → release-3.0",
			expect.anything(),
		);
		const data = await res.json();
		expect(data.mrSourceBranch).toBe("custom-branch");
	});

	it("falls back to listBranches when no sourceBranchOverride", async () => {
		await seedEntry("fallback-branch-test", "release-4.0", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-21" }],
		});
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "main", default: true },
			{ name: "release-4.0", default: false },
		]);
		mockGitlabCreateMergeRequest.mockResolvedValueOnce({
			webUrl: "https://gitlab.com/mr/fallback",
		});

		const res = await app.fetch(
			new Request("http://localhost/api/history/fallback-branch-test/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);
		expect(res.status).toBe(200);
		// Should use default branch since no mrSourceBranch stored
		expect(mockGitlabCreateMergeRequest).toHaveBeenCalledWith(
			5,
			"main",
			"release-4.0",
			"main → release-4.0",
			expect.anything(),
		);
	});

	it("finds existing MR via 'already exists' fallback in createMrForRelease", async () => {
		await seedEntry("already-exists-exec", "develop", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-30" }],
		});
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "feature-x", default: true },
		]);
		mockGitlabCreateMergeRequest.mockRejectedValueOnce(
			new Error("Merge request already exists: feature-x → develop"),
		);
		mockGitlabListMergeRequests.mockResolvedValueOnce([
			{
				sourceBranch: "feature-x",
				targetBranch: "develop",
				webUrl: "https://gitlab.com/existing-mr/1",
			},
		]);

		const res = await app.fetch(
			new Request("http://localhost/api/history/already-exists-exec/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.mrUrl).toBe("https://gitlab.com/existing-mr/1");
		expect(data.mrSourceBranch).toBe("feature-x");
		expect(data.mrTargetBranch).toBe("develop");
	});

	it("returns undefined when MR creation fails with non-'already exists' error", async () => {
		await seedEntry("mr-fail-exec", "develop", "PROJ");
		mockGitlabGetFile.mockResolvedValueOnce({ content: POM_BASE64 });
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-31" }],
		});
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "main", default: true },
		]);
		mockGitlabCreateMergeRequest.mockRejectedValueOnce(
			new Error("Internal server error"),
		);

		const res = await app.fetch(
			new Request("http://localhost/api/history/mr-fail-exec/execute", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ createMr: true }),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.issueKey).toBe("PROJ-31");
		expect(data.mrUrl).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// History CRUD API
// ---------------------------------------------------------------------------
describe("Release routes – History CRUD", () => {
	it("GET /api/history returns stored entries", async () => {
		const res = await app.fetch(new Request("http://localhost/api/history"));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(Array.isArray(data)).toBe(true);
	});

	it("POST /api/history adds an entry", async () => {
		const res = await app.fetch(
			new Request("http://localhost/api/history", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: 1,
					projectName: "test",
					projectPath: "group/test",
					branch: "main",
					jiraProjectKey: "PROJ",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ ok: true });
	});

	it("DELETE /api/history clears all entries", async () => {
		const res = await app.fetch(
			new Request("http://localhost/api/history", {
				method: "DELETE",
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ ok: true });
	});
});

// ---------------------------------------------------------------------------
// i18n key completeness for MR-related keys
// ---------------------------------------------------------------------------
describe("i18n – release MR keys exist in both locales", () => {
	it("has all release MR keys in en.json", async () => {
		const en = await import("../i18n/locales/en.json");
		const keys = en.release;
		expect(keys.selectMrBranch).toBeDefined();
		expect(keys.confirmCreateMr).toBeDefined();
		expect(keys.creatingMrBtn).toBeDefined();
		expect(keys.mrFromTo).toBeDefined();
		expect(keys.mrCreated).toBeDefined();
		expect(keys.noSourceBranches).toBeDefined();
	});

	it("has all release MR keys in zh-CN.json", async () => {
		const zh = await import("../i18n/locales/zh-CN.json");
		const keys = zh.release;
		expect(keys.selectMrBranch).toBeDefined();
		expect(keys.confirmCreateMr).toBeDefined();
		expect(keys.creatingMrBtn).toBeDefined();
		expect(keys.mrFromTo).toBeDefined();
		expect(keys.mrCreated).toBeDefined();
		expect(keys.noSourceBranches).toBeDefined();
	});

	it("has web MR keys in en.json", async () => {
		const en = await import("../i18n/locales/en.json");
		const keys = en.web;
		expect(keys.createMrBtn).toBeDefined();
		expect(keys.creatingMrBtn).toBeDefined();
		expect(keys.confirmCreateMr).toBeDefined();
		expect(keys.loadingMr).toBeDefined();
		expect(keys.createMrCheckbox).toBeDefined();
	});

	it("has web MR keys in zh-CN.json", async () => {
		const zh = await import("../i18n/locales/zh-CN.json");
		const keys = zh.web;
		expect(keys.createMrBtn).toBeDefined();
		expect(keys.creatingMrBtn).toBeDefined();
		expect(keys.confirmCreateMr).toBeDefined();
		expect(keys.loadingMr).toBeDefined();
		expect(keys.createMrCheckbox).toBeDefined();
	});
});
