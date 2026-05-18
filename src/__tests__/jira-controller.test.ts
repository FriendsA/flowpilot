import { beforeEach, describe, expect, it, vi } from "vitest";
import { JiraController } from "../jira-controller";

vi.mock("../i18n/cli", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			"error.jiraHostMissing":
				"Jira host not configured. Run `flowpilot config` first.",
			"error.jiraCredentialsMissing":
				"Jira credentials not configured. Run `flowpilot config` first.",
			"error.gitlabHostMissing":
				"GitLab host not configured. Run `flowpilot config` first.",
			"error.gitlabTokenMissing":
				"GitLab token not configured. Run `flowpilot config` first.",
		};
		return translations[key] ?? key;
	},
}));

let _testCreds = {
	host: "https://test.jira.com" as string | undefined,
	name: "testuser" as string | undefined,
	password: "testpass" as string | undefined,
};

function setCreds(name?: string, password?: string) {
	_testCreds = { host: "https://test.jira.com", name, password };
}

vi.mock("../config", () => ({
	ConfigJson: class {
		get(key: string) {
			if (key === "jiraHost") return _testCreds.host;
			if (key === "jiraName") return _testCreds.name;
			if (key === "jiraPassword") return _testCreds.password;
			return undefined;
		}
	},
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonRes(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function lastCall(): [string, RequestInit] {
	return mockFetch.mock.calls[0] as [string, RequestInit];
}

beforeEach(() => {
	vi.clearAllMocks();
	setCreds("testuser", "testpass");
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------
describe("JiraController – constructor", () => {
	it("throws when jiraName is missing", () => {
		setCreds(undefined, "testpass");
		expect(() => new JiraController()).toThrow(
			"Jira credentials not configured",
		);
	});

	it("throws when jiraPassword is missing", () => {
		setCreds("testuser", undefined);
		expect(() => new JiraController()).toThrow(
			"Jira credentials not configured",
		);
	});

	it("initializes with valid credentials", () => {
		expect(() => new JiraController()).not.toThrow();
	});

	it("uses custom host when provided", () => {
		_testCreds.host = "https://custom.jira.com";
		const ctrl = new JiraController();
		mockFetch.mockResolvedValueOnce(
			jsonRes({ displayName: "A", emailAddress: "a@b.c" }),
		);
		ctrl.myself();
		expect(lastCall()[0]).toContain("custom.jira.com");
	});
});

// ---------------------------------------------------------------------------
// request – headers & error handling
// ---------------------------------------------------------------------------
describe("JiraController – request basics", () => {
	it("sends Basic auth header", async () => {
		mockFetch.mockResolvedValueOnce(
			jsonRes({ displayName: "A", emailAddress: "a@b.c" }),
		);

		await new JiraController().myself();

		const headers = lastCall()[1].headers as Record<string, string>;
		expect(headers.Authorization).toBe(
			`Basic ${Buffer.from("testuser:testpass").toString("base64")}`,
		);
	});

	it("sends JSON content-type and accept headers", async () => {
		mockFetch.mockResolvedValueOnce(
			jsonRes({ displayName: "A", emailAddress: "a@b.c" }),
		);

		await new JiraController().myself();

		const headers = lastCall()[1].headers as Record<string, string>;
		expect(headers["Content-Type"]).toBe("application/json");
		expect(headers.Accept).toBe("application/json");
	});

	it("throws on non-ok response", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response("Unauthorized", { status: 401 }),
		);

		await expect(new JiraController().myself()).rejects.toThrow("Jira API 401");
	});
});

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------
describe("JiraController – myself", () => {
	it("GET /rest/api/2/myself", async () => {
		const payload = { displayName: "Tester", emailAddress: "t@e.st" };
		mockFetch.mockResolvedValueOnce(jsonRes(payload));

		const result = await new JiraController().myself();

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining("/rest/api/2/myself"),
			expect.any(Object),
		);
		expect(result).toEqual(payload);
	});
});

describe("JiraController – search", () => {
	it("encodes JQL and passes maxResults", async () => {
		const payload = { total: 1, issues: [] };
		mockFetch.mockResolvedValueOnce(jsonRes(payload));

		await new JiraController().search("assignee = currentUser()", 20);

		const url = lastCall()[0] as string;
		expect(url).toContain("jql=assignee%20%3D%20currentUser()");
		expect(url).toContain("maxResults=20");
	});

	it("defaults maxResults to 50", async () => {
		mockFetch.mockResolvedValueOnce(jsonRes({ total: 0, issues: [] }));

		await new JiraController().search("status = Open");

		expect(lastCall()[0]).toContain("maxResults=50");
	});
});

describe("JiraController – getIssue", () => {
	it("GET /rest/api/2/issue/{key}", async () => {
		const issue = {
			key: "PROJ-123",
			fields: {
				summary: "Fix bug",
				status: { name: "In Progress" },
				assignee: { displayName: "Dev" },
				issuetype: { name: "Bug" },
				priority: { name: "High" },
				created: "2025-01-01",
				updated: "2025-01-02",
			},
		};
		mockFetch.mockResolvedValueOnce(jsonRes(issue));

		const result = await new JiraController().getIssue("PROJ-123");

		expect(lastCall()[0]).toContain("/rest/api/2/issue/PROJ-123");
		expect(result.key).toBe("PROJ-123");
		expect(result.fields.status.name).toBe("In Progress");
	});
});

describe("JiraController – getTransitions", () => {
	it("returns available transitions", async () => {
		const payload = {
			transitions: [
				{ id: "11", name: "To Do" },
				{ id: "21", name: "Done" },
			],
		};
		mockFetch.mockResolvedValueOnce(jsonRes(payload));

		const result = await new JiraController().getTransitions("PROJ-1");

		expect(lastCall()[0]).toContain("/rest/api/2/issue/PROJ-1/transitions");
		expect(result.transitions).toHaveLength(2);
	});
});

describe("JiraController – transitionIssue", () => {
	it("POST transition with correct body", async () => {
		mockFetch.mockResolvedValueOnce(jsonRes({}));

		await new JiraController().transitionIssue("PROJ-1", "21");

		const [url, init] = lastCall();
		expect(url).toContain("/rest/api/2/issue/PROJ-1/transitions");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body as string)).toEqual({
			transition: { id: "21" },
		});
	});
});

describe("JiraController – addComment", () => {
	it("POST comment with correct body", async () => {
		mockFetch.mockResolvedValueOnce(jsonRes({ id: "12345" }));

		const result = await new JiraController().addComment(
			"PROJ-1",
			"Looking into this.",
		);

		const [url, init] = lastCall();
		expect(url).toContain("/rest/api/2/issue/PROJ-1/comment");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body as string)).toEqual({
			body: "Looking into this.",
		});
		expect(result.id).toBe("12345");
	});
});
