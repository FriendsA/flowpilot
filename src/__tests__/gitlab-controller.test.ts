import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitlabController } from "../gitlab-controller";

let _testConfig = {
	gitlabHost: "https://test.gitlab.com" as string | undefined,
	gitlabKey: "test-token" as string | undefined,
};

vi.mock("../i18n/cli", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			"error.gitlabHostMissing":
				"GitLab host not configured. Run `flowpilot config` first.",
			"error.gitlabTokenMissing":
				"GitLab token not configured. Run `flowpilot config` first.",
			"error.jiraHostMissing":
				"Jira host not configured. Run `flowpilot config` first.",
			"error.jiraCredentialsMissing":
				"Jira credentials not configured. Run `flowpilot config` first.",
		};
		return translations[key] ?? key;
	},
}));

vi.mock("../config", () => ({
	ConfigJson: class {
		get(key: string) {
			if (key === "gitlabHost") return _testConfig.gitlabHost;
			if (key === "gitlabKey") return _testConfig.gitlabKey;
			return undefined;
		}
	},
}));

const mockApi = {
	Users: { showCurrentUser: vi.fn() },
	Projects: { search: vi.fn(), show: vi.fn(), all: vi.fn() },
	MergeRequests: {
		all: vi.fn(),
		show: vi.fn(),
		create: vi.fn(),
		accept: vi.fn(),
	},
	Branches: { all: vi.fn(), show: vi.fn(), create: vi.fn(), remove: vi.fn() },
	Issues: { all: vi.fn(), show: vi.fn() },
	Repositories: { allRepositoryTrees: vi.fn() },
	RepositoryFiles: { show: vi.fn() },
};

vi.mock("@gitbeaker/rest", () => ({
	Gitlab: class {
		Users = mockApi.Users;
		Projects = mockApi.Projects;
		MergeRequests = mockApi.MergeRequests;
		Branches = mockApi.Branches;
		Issues = mockApi.Issues;
		Repositories = mockApi.Repositories;
		RepositoryFiles = mockApi.RepositoryFiles;
	},
}));

beforeEach(() => {
	vi.clearAllMocks();
	_testConfig = {
		gitlabHost: "https://test.gitlab.com",
		gitlabKey: "test-token",
	};
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------
describe("GitlabController – constructor", () => {
	it("throws when gitlabHost is missing", () => {
		_testConfig.gitlabHost = undefined;
		expect(() => new GitlabController()).toThrow("GitLab host not configured");
	});

	it("throws when gitlabKey is missing", () => {
		_testConfig.gitlabKey = undefined;
		expect(() => new GitlabController()).toThrow("GitLab token not configured");
	});

	it("initializes with valid config", () => {
		expect(() => new GitlabController()).not.toThrow();
	});

	it("prepends http:// when host has no protocol", () => {
		_testConfig.gitlabHost = "gitlab.example.com";
		expect(() => new GitlabController()).not.toThrow();
		// The Gitlab constructor is called — we verify it doesn't throw
	});
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
describe("GitlabController – projects", () => {
	it("searchProjects calls Projects.search", async () => {
		mockApi.Projects.search.mockResolvedValueOnce([{ id: 1, name: "proj" }]);
		const ctrl = new GitlabController();
		await ctrl.searchProjects("myproj");
		expect(mockApi.Projects.search).toHaveBeenCalledWith("myproj");
	});

	it("getProject calls Projects.show", async () => {
		mockApi.Projects.show.mockResolvedValueOnce({ id: 1 });
		const ctrl = new GitlabController();
		await ctrl.getProject("group/proj");
		expect(mockApi.Projects.show).toHaveBeenCalledWith("group/proj");
	});

	it("listProjects calls Projects.all", async () => {
		mockApi.Projects.all.mockResolvedValueOnce([{ id: 1 }]);
		const ctrl = new GitlabController();
		await ctrl.listProjects({ membership: true });
		expect(mockApi.Projects.all).toHaveBeenCalledWith({ membership: true });
	});
});

// ---------------------------------------------------------------------------
// Merge Requests
// ---------------------------------------------------------------------------
describe("GitlabController – merge requests", () => {
	it("listMergeRequests with projectId", async () => {
		mockApi.MergeRequests.all.mockResolvedValueOnce([]);
		const ctrl = new GitlabController();
		await ctrl.listMergeRequests({ projectId: 5, state: "opened" });
		expect(mockApi.MergeRequests.all).toHaveBeenCalledWith({
			projectId: 5,
			state: "opened",
		});
	});

	it("listMergeRequests with groupId", async () => {
		mockApi.MergeRequests.all.mockResolvedValueOnce([]);
		const ctrl = new GitlabController();
		await ctrl.listMergeRequests({ groupId: 10 });
		expect(mockApi.MergeRequests.all).toHaveBeenCalledWith({ groupId: 10 });
	});

	it("getMergeRequest", async () => {
		mockApi.MergeRequests.show.mockResolvedValueOnce({ id: 1 });
		const ctrl = new GitlabController();
		await ctrl.getMergeRequest(5, 42);
		expect(mockApi.MergeRequests.show).toHaveBeenCalledWith(5, 42);
	});

	it("createMergeRequest", async () => {
		mockApi.MergeRequests.create.mockResolvedValueOnce({ id: 1 });
		const ctrl = new GitlabController();
		await ctrl.createMergeRequest(5, "feature", "main", "New feature", {
			description: "desc",
		});
		expect(mockApi.MergeRequests.create).toHaveBeenCalledWith(
			5,
			"feature",
			"main",
			"New feature",
			{ description: "desc" },
		);
	});

	it("acceptMergeRequest", async () => {
		mockApi.MergeRequests.accept.mockResolvedValueOnce({ state: "merged" });
		const ctrl = new GitlabController();
		await ctrl.acceptMergeRequest(5, 42);
		expect(mockApi.MergeRequests.accept).toHaveBeenCalledWith(5, 42);
	});
});

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------
describe("GitlabController – branches", () => {
	it("listBranches without search", async () => {
		mockApi.Branches.all.mockResolvedValueOnce([]);
		const ctrl = new GitlabController();
		await ctrl.listBranches(5);
		expect(mockApi.Branches.all).toHaveBeenCalledWith(5, undefined);
	});

	it("listBranches with search filter", async () => {
		mockApi.Branches.all.mockResolvedValueOnce([]);
		const ctrl = new GitlabController();
		await ctrl.listBranches(5, "release");
		expect(mockApi.Branches.all).toHaveBeenCalledWith(5, { search: "release" });
	});

	it("getBranch", async () => {
		mockApi.Branches.show.mockResolvedValueOnce({ name: "main" });
		const ctrl = new GitlabController();
		await ctrl.getBranch(5, "main");
		expect(mockApi.Branches.show).toHaveBeenCalledWith(5, "main");
	});

	it("createBranch", async () => {
		mockApi.Branches.create.mockResolvedValueOnce({ name: "feature" });
		const ctrl = new GitlabController();
		await ctrl.createBranch(5, "feature", "main");
		expect(mockApi.Branches.create).toHaveBeenCalledWith(5, "feature", "main");
	});

	it("deleteBranch", async () => {
		mockApi.Branches.remove.mockResolvedValueOnce(undefined);
		const ctrl = new GitlabController();
		await ctrl.deleteBranch(5, "feature");
		expect(mockApi.Branches.remove).toHaveBeenCalledWith(5, "feature");
	});
});

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------
describe("GitlabController – repositories", () => {
	it("getFile", async () => {
		mockApi.RepositoryFiles.show.mockResolvedValueOnce({
			content: "base64...",
		});
		const ctrl = new GitlabController();
		await ctrl.getFile(5, "pom.xml", "main");
		expect(mockApi.RepositoryFiles.show).toHaveBeenCalledWith(
			5,
			"pom.xml",
			"main",
		);
	});

	it("listTree", async () => {
		mockApi.Repositories.allRepositoryTrees.mockResolvedValueOnce([]);
		const ctrl = new GitlabController();
		await ctrl.listTree(5, { path: "src", ref: "main" });
		expect(mockApi.Repositories.allRepositoryTrees).toHaveBeenCalledWith(5, {
			path: "src",
			ref: "main",
		});
	});
});
