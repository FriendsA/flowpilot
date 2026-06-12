import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { releaseRoutes } from "../commands/release/routes";

// Mock i18n/web (used by the middleware that renders pages)
vi.mock("../i18n/web", () => ({
	t: (key: string) => key,
	initI18n: vi.fn().mockResolvedValue(undefined),
	detectLocaleFromCookie: vi.fn().mockReturnValue(null),
	detectLocaleFromHeader: vi.fn().mockReturnValue("zh-CN"),
	getLocaleResources: vi.fn().mockReturnValue({ translation: {} }),
}));

// Mock translateApiError — return raw error message in tests
vi.mock("../i18n/translate-error", () => ({
	translateApiError: (raw: unknown) =>
		raw instanceof Error ? raw.message : String(raw),
}));

// Mock Layout so SSR doesn't need real JSX rendering
vi.mock("../shared/layout", () => ({
	Layout: ({ children }: { children: string }) => children,
}));

// Mock ConfigJson — test config validation redirect
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
const { mockGitlabListProjects, mockGitlabListBranches, mockGitlabGetFile } =
	vi.hoisted(() => ({
		mockGitlabListProjects: vi.fn(),
		mockGitlabListBranches: vi.fn(),
		mockGitlabGetFile: vi.fn(),
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

// Build a test app — use releaseRoutes directly since it defines paths from "/"
const app = releaseRoutes;

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Root page — config validation redirect
// ---------------------------------------------------------------------------
describe("Release routes – GET /release/", () => {
	it("redirects to /config when required keys missing", async () => {
		mockConfigGetConfig.mockReturnValue({
			jiraHost: "",
			jiraName: "",
			jiraPassword: "",
			gitlabHost: "",
			gitlabKey: "",
		});
		const res = await app.fetch(new Request("http://localhost/"));
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/config");
	});

	it("renders page when all config present", async () => {
		mockConfigGetConfig.mockReturnValue({
			jiraHost: "https://jira.com",
			jiraName: "user",
			jiraPassword: "pass",
			gitlabHost: "https://gitlab.com",
			gitlabKey: "token",
		});
		const res = await app.fetch(new Request("http://localhost/"));
		expect(res.status).toBe(200);
	});
});

// ---------------------------------------------------------------------------
// Config API
// ---------------------------------------------------------------------------
describe("Release routes – GET /release/api/config", () => {
	it("returns jiraHost and gitlabHost from config", async () => {
		mockConfigGetConfig.mockReturnValue({
			jiraHost: "https://jira.com",
			gitlabHost: "https://gitlab.com",
			jiraName: "user",
			jiraPassword: "pass",
			gitlabKey: "token",
		});
		const res = await app.fetch(new Request("http://localhost/api/config"));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({
			jiraHost: "https://jira.com",
			gitlabHost: "https://gitlab.com",
		});
	});

	it("returns empty strings for missing hosts", async () => {
		mockConfigGetConfig.mockReturnValue({});
		const res = await app.fetch(new Request("http://localhost/api/config"));
		const data = await res.json();
		expect(data).toEqual({ jiraHost: "", gitlabHost: "" });
	});
});

// ---------------------------------------------------------------------------
// Projects API
// ---------------------------------------------------------------------------
describe("Release routes – GET /release/api/projects", () => {
	it("returns projects from GitlabController", async () => {
		mockGitlabListProjects.mockResolvedValueOnce([{ id: 1, name: "proj" }]);
		const res = await app.fetch(new Request("http://localhost/api/projects"));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual([{ id: 1, name: "proj" }]);
	});

	it("returns error on GitlabController failure", async () => {
		mockGitlabListProjects.mockRejectedValueOnce(
			new Error("connection failed"),
		);
		const res = await app.fetch(new Request("http://localhost/api/projects"));
		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data).toEqual({ error: "connection failed" });
	});
});

// ---------------------------------------------------------------------------
// Branches API
// ---------------------------------------------------------------------------
describe("Release routes – GET /release/api/projects/:id/branches", () => {
	it("returns branches for a project", async () => {
		mockGitlabListBranches.mockResolvedValueOnce([
			{ name: "main", default: true },
		]);
		const res = await app.fetch(
			new Request("http://localhost/api/projects/5/branches"),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual([{ name: "main", default: true }]);
	});

	it("returns error on failure", async () => {
		mockGitlabListBranches.mockRejectedValueOnce(
			new Error("project not found"),
		);
		const res = await app.fetch(
			new Request("http://localhost/api/projects/999/branches"),
		);
		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data).toEqual({ error: "project not found" });
	});
});

// ---------------------------------------------------------------------------
// POM version API
// ---------------------------------------------------------------------------
describe("Release routes – GET /release/api/projects/:id/pom-version", () => {
	it("returns parsed POM version info", async () => {
		// Minimal valid pom.xml base64
		const pomXml = `<project><groupId>com.ex</groupId><artifactId>app</artifactId><version>1.0</version><properties><releaseName>my-flow-app</releaseName></properties></project>`;
		const base64 = Buffer.from(pomXml).toString("base64").replace(/\n/g, "");
		mockGitlabGetFile.mockResolvedValueOnce({ content: base64 });
		const res = await app.fetch(
			new Request("http://localhost/api/projects/5/pom-version?ref=master"),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.version).toBe("1.0");
		expect(data.groupId).toBe("com.ex");
		expect(data.flowPilotName).toBe("my-flow-app");
	});

	it("defaults ref to master when not specified", async () => {
		const pomXml = `<project><groupId>g</groupId><artifactId>a</artifactId><version>2.0</version><properties><releaseName>fa</releaseName></properties></project>`;
		const base64 = Buffer.from(pomXml).toString("base64").replace(/\n/g, "");
		mockGitlabGetFile.mockResolvedValueOnce({ content: base64 });
		await app.fetch(new Request("http://localhost/api/projects/5/pom-version"));
		expect(mockGitlabGetFile).toHaveBeenCalledWith("5", "pom.xml", "master");
	});

	it("returns null releaseName when properties section missing", async () => {
		const pomXml = `<project><groupId>com.ex</groupId><artifactId>app</artifactId><version>1.0</version></project>`;
		const base64 = Buffer.from(pomXml).toString("base64").replace(/\n/g, "");

		mockGitlabGetFile.mockResolvedValueOnce({ content: base64 });
		const res = await app.fetch(
			new Request("http://localhost/api/projects/5/pom-version?ref=master"),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.flowPilotName).toBeNull();
	});

	it("returns error on failure", async () => {
		mockGitlabGetFile.mockRejectedValueOnce(new Error("file not found"));
		const res = await app.fetch(
			new Request("http://localhost/api/projects/5/pom-version?ref=main"),
		);
		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data).toEqual({ error: "file not found" });
	});
});

// ---------------------------------------------------------------------------
// Jira search API
// ---------------------------------------------------------------------------
describe("Release routes – POST /release/api/jira/search", () => {
	it("returns search results", async () => {
		mockJiraSearch.mockResolvedValueOnce({
			total: 1,
			issues: [{ key: "PROJ-1" }],
		});
		const res = await app.fetch(
			new Request("http://localhost/api/jira/search", {
				method: "POST",
				body: JSON.stringify({ jql: "project = PROJ", maxResults: 5 }),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ total: 1, issues: [{ key: "PROJ-1" }] });
	});

	it("defaults maxResults to 5 when not provided", async () => {
		mockJiraSearch.mockResolvedValueOnce({ total: 0, issues: [] });
		await app.fetch(
			new Request("http://localhost/api/jira/search", {
				method: "POST",
				body: JSON.stringify({ jql: "project = PROJ" }),
			}),
		);
		expect(mockJiraSearch).toHaveBeenCalledWith("project = PROJ", 5);
	});

	it("returns error on failure", async () => {
		mockJiraSearch.mockRejectedValueOnce(new Error("jira error"));
		const res = await app.fetch(
			new Request("http://localhost/api/jira/search", {
				method: "POST",
				body: JSON.stringify({ jql: "project = PROJ" }),
			}),
		);
		expect(res.status).toBe(500);
	});
});

// ---------------------------------------------------------------------------
// Jira ensure-version API
// ---------------------------------------------------------------------------
describe("Release routes – POST /release/api/jira/ensure-version", () => {
	it("returns existing version when found", async () => {
		mockJiraGetProjectVersions.mockResolvedValueOnce([
			{ id: "v1", name: "1.0.0" },
		]);
		const res = await app.fetch(
			new Request("http://localhost/api/jira/ensure-version", {
				method: "POST",
				body: JSON.stringify({ projectKey: "PROJ", versionName: "1.0.0" }),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ id: "v1", name: "1.0.0", created: false });
	});

	it("creates new version when not found", async () => {
		mockJiraGetProjectVersions.mockResolvedValueOnce([]);
		mockJiraCreateVersion.mockResolvedValueOnce({ id: "v2", name: "2.0.0" });
		const res = await app.fetch(
			new Request("http://localhost/api/jira/ensure-version", {
				method: "POST",
				body: JSON.stringify({ projectKey: "PROJ", versionName: "2.0.0" }),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ id: "v2", name: "2.0.0", created: true });
	});

	it("returns error on failure", async () => {
		mockJiraGetProjectVersions.mockRejectedValueOnce(new Error("jira down"));
		const res = await app.fetch(
			new Request("http://localhost/api/jira/ensure-version", {
				method: "POST",
				body: JSON.stringify({ projectKey: "PROJ", versionName: "1.0.0" }),
			}),
		);
		expect(res.status).toBe(500);
	});
});

// ---------------------------------------------------------------------------
// Jira create-issue API
// ---------------------------------------------------------------------------
describe("Release routes – POST /release/api/jira/create-issue", () => {
	it("creates issue and returns key", async () => {
		mockJiraCreateIssue.mockResolvedValueOnce({ id: "123", key: "PROJ-42" });
		const res = await app.fetch(
			new Request("http://localhost/api/jira/create-issue", {
				method: "POST",
				body: JSON.stringify({
					projectKey: "PROJ",
					summary: "Release 1.0",
					issuetypeId: "10000",
					customfield_15800: "无",
					customfield_13410: [{ id: "v1" }],
					customfield_13341: [{ name: "user" }],
				}),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ key: "PROJ-42" });
	});

	it("returns error on failure", async () => {
		mockJiraCreateIssue.mockRejectedValueOnce(new Error("creation failed"));
		const res = await app.fetch(
			new Request("http://localhost/api/jira/create-issue", {
				method: "POST",
				body: JSON.stringify({ projectKey: "PROJ", summary: "test" }),
			}),
		);
		expect(res.status).toBe(500);
	});
});

// ---------------------------------------------------------------------------
// Jira projects API
// ---------------------------------------------------------------------------
describe("Release routes – GET /release/api/jira/projects", () => {
	it("returns project keys", async () => {
		mockJiraListProjectKeys.mockResolvedValueOnce([
			{ key: "PROJ", id: "10000" },
		]);
		const res = await app.fetch(
			new Request("http://localhost/api/jira/projects"),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual([{ key: "PROJ", id: "10000" }]);
	});

	it("returns error on failure", async () => {
		mockJiraListProjectKeys.mockRejectedValueOnce(
			new Error("jira unavailable"),
		);
		const res = await app.fetch(
			new Request("http://localhost/api/jira/projects"),
		);
		expect(res.status).toBe(500);
	});
});
