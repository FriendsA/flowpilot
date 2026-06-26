import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractProjectPath, isGitRepo } from "../utils/git";
import { cleanVersion, parsePomXml } from "../utils/pom";
import { filterByRelevance } from "../utils/search";

// ---------------------------------------------------------------------------
// utils/config.ts – validateConfigOrWarn
// ---------------------------------------------------------------------------
vi.hoisted(() => ({
	mockConsoleError: vi.fn(),
}));

vi.mock("../config", () => ({
	ConfigJson: class {
		getConfig() {
			return _testFullConfig;
		}
	},
}));

vi.mock("../i18n/cli", () => ({
	t: (key: string) => {
		const translations: Record<string, string> = {
			"error.configMissing": "Missing configuration:",
			"error.runConfig": "Run `flowpilot config` to set these values.",
		};
		return translations[key] ?? key;
	},
}));

vi.mock("picocolors", () => ({
	default: {
		red: (s: string) => s,
		bold: (s: string) => s,
		dim: (s: string) => s,
	},
	red: (s: string) => s,
	bold: (s: string) => s,
	dim: (s: string) => s,
}));

let _testFullConfig: Record<string, string | undefined> = {
	jiraHost: "https://jira.com",
	jiraName: "user",
	jiraPassword: "pass",
	gitlabHost: "https://gitlab.com",
	gitlabKey: "token",
};

// Must import after mocks
import { validateConfigOrWarn } from "../utils/config";

describe("validateConfigOrWarn", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		_testFullConfig = {
			jiraHost: "https://jira.com",
			jiraName: "user",
			jiraPassword: "pass",
			gitlabHost: "https://gitlab.com",
			gitlabKey: "token",
		};
	});

	it("returns true when all keys present", () => {
		expect(validateConfigOrWarn()).toBe(true);
	});

	it("returns false when jiraHost missing", () => {
		_testFullConfig.jiraHost = undefined;
		expect(validateConfigOrWarn()).toBe(false);
	});

	it("returns false when multiple keys missing", () => {
		_testFullConfig.jiraHost = undefined;
		_testFullConfig.gitlabKey = undefined;
		expect(validateConfigOrWarn()).toBe(false);
	});

	it("returns false when all keys missing", () => {
		_testFullConfig = {};
		expect(validateConfigOrWarn()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// git.ts – repo detection and extractProjectPath
// ---------------------------------------------------------------------------
describe("isGitRepo", () => {
	it("returns true for an explicit git repository cwd", () => {
		const repoDir = mkdtempSync(join(tmpdir(), "flowpilot-git-"));
		execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });

		expect(isGitRepo({ cwd: repoDir })).toBe(true);
	});
});

describe("extractProjectPath", () => {
	it("extracts path from HTTPS URL", () => {
		expect(extractProjectPath("https://gitlab.com/group/project.git")).toBe(
			"group/project",
		);
	});

	it("extracts path from HTTPS URL without .git suffix", () => {
		expect(extractProjectPath("https://gitlab.com/group/project")).toBe(
			"group/project",
		);
	});

	it("extracts path from SSH URL", () => {
		expect(extractProjectPath("git@gitlab.com:group/project.git")).toBe(
			"group/project",
		);
	});

	it("extracts path from SSH URL without .git suffix", () => {
		expect(extractProjectPath("git@gitlab.com:group/project")).toBe(
			"group/project",
		);
	});

	it("extracts nested path from HTTPS URL", () => {
		expect(
			extractProjectPath("https://gitlab.com/org/subgroup/project.git"),
		).toBe("org/subgroup/project");
	});

	it("extracts nested path from SSH URL", () => {
		expect(extractProjectPath("git@gitlab.com:org/subgroup/project.git")).toBe(
			"org/subgroup/project",
		);
	});

	it("strips trailing slashes", () => {
		expect(extractProjectPath("https://gitlab.com/group/project/")).toBe(
			"group/project",
		);
	});

	it("throws on unrecognized URL format", () => {
		expect(() => extractProjectPath("ftp://server/path")).toThrow(
			"Cannot extract project path",
		);
	});

	it("handles HTTP (non-SSL) URL", () => {
		expect(extractProjectPath("http://gitlab.internal/team/repo.git")).toBe(
			"team/repo",
		);
	});
});

// ---------------------------------------------------------------------------
// pom.ts – parsePomXml & cleanVersion
// ---------------------------------------------------------------------------
describe("parsePomXml", () => {
	it("extracts version, groupId, releaseName from properties", () => {
		const pom = `<project>
			<groupId>com.example</groupId>
			<artifactId>my-app</artifactId>
			<version>1.2.3</version>
			<properties>
				<releaseName>my-flow-app</releaseName>
			</properties>
		</project>`;
		const result = parsePomXml(pom);
		expect(result).toEqual({
			version: "1.2.3",
			groupId: "com.example",
			artifactId: "my-app",
			flowPilotName: "my-flow-app",
			jenkinsJobName: null,
		});
	});

	it("returns null for releaseName when properties section is missing", () => {
		const pom = `<project>
			<groupId>com.example</groupId>
			<artifactId>my-app</artifactId>
			<version>1.2.3</version>
		</project>`;
		const result = parsePomXml(pom);
		expect(result.version).toBe("1.2.3");
		expect(result.groupId).toBe("com.example");
		expect(result.flowPilotName).toBeNull();
	});

	it("falls back to parent when child version is missing", () => {
		const pom = `<project>
			<parent>
				<groupId>com.parent</groupId>
				<artifactId>parent-app</artifactId>
				<version>1.0.0</version>
			</parent>
			<groupId>com.example</groupId>
			<artifactId>my-app</artifactId>
			<properties>
				<releaseName>my-flow-app</releaseName>
			</properties>
		</project>`;
		const result = parsePomXml(pom);
		expect(result.version).toBe("1.0.0");
		expect(result.groupId).toBe("com.example");
		expect(result.flowPilotName).toBe("my-flow-app");
	});

	it("supports dot notation in properties", () => {
		const pom = `<project>
			<groupId>com.example</groupId>
			<artifactId>my-app</artifactId>
			<version>1.2.3</version>
			<properties>
				<flowpilot.releaseName>dot-name</flowpilot.releaseName>
				<flowpilot.jenkinsJob>dot-job</flowpilot.jenkinsJob>
			</properties>
		</project>`;
		const result = parsePomXml(pom);
		expect(result.flowPilotName).toBe("dot-name");
		expect(result.jenkinsJobName).toBe("dot-job");
	});

	it("returns null for all fields on empty string", () => {
		const result = parsePomXml("");
		expect(result).toEqual({
			version: null,
			groupId: null,
			artifactId: null,
			flowPilotName: null,
			jenkinsJobName: null,
		});
	});

	it("returns null when no tags present", () => {
		const result = parsePomXml("<project></project>");
		expect(result).toEqual({
			version: null,
			groupId: null,
			artifactId: null,
			flowPilotName: null,
			jenkinsJobName: null,
		});
	});

	it("extracts from <flowpilot> top-level element", () => {
		const pom = `<project>
			<groupId>com.example</groupId>
			<version>2.0.0</version>
			<flowpilot>
				<releaseName>my-service</releaseName>
				<jenkinsJob>my-service-deploy</jenkinsJob>
			</flowpilot>
		</project>`;
		const result = parsePomXml(pom);
		expect(result.flowPilotName).toBe("my-service");
		expect(result.jenkinsJobName).toBe("my-service-deploy");
	});

	it("<flowpilot> takes precedence over properties", () => {
		const pom = `<project>
			<groupId>com.example</groupId>
			<version>2.0.0</version>
			<flowpilot>
				<releaseName>new-name</releaseName>
				<jenkinsJob>new-job</jenkinsJob>
			</flowpilot>
			<properties>
				<releaseName>old-name</releaseName>
				<jenkinsJob>old-job</jenkinsJob>
			</properties>
		</project>`;
		const result = parsePomXml(pom);
		expect(result.flowPilotName).toBe("new-name");
		expect(result.jenkinsJobName).toBe("new-job");
	});
});

describe("cleanVersion", () => {
	it("returns version without suffix", () => {
		expect(cleanVersion("1.2.3-SNAPSHOT")).toBe("1.2.3");
	});

	it("returns full version when no suffix", () => {
		expect(cleanVersion("1.2.3")).toBe("1.2.3");
	});

	it("returns empty string for null", () => {
		expect(cleanVersion(null)).toBe("");
	});

	it("handles multiple suffix segments", () => {
		expect(cleanVersion("2.0.0-RC1-beta")).toBe("2.0.0");
	});
});

// ---------------------------------------------------------------------------
// search.ts – filterByRelevance
// ---------------------------------------------------------------------------
describe("filterByRelevance", () => {
	const items = [
		{ name: "frontend-app", path: "team/frontend" },
		{ name: "backend-service", path: "team/backend" },
		{ name: "shared-utils", path: "infra/shared" },
		{ name: "app", path: "root/app" },
		{ name: "frontend-admin", path: "team/admin" },
	];

	it("returns items up to limit when no query", () => {
		const result = filterByRelevance(items, "");
		expect(result).toHaveLength(5);
	});

	it("respects custom limit", () => {
		const result = filterByRelevance(items, "", 2);
		expect(result).toHaveLength(2);
	});

	it("exact name match gets highest priority", () => {
		const result = filterByRelevance(items, "app");
		expect(result[0]?.name).toBe("app");
	});

	it("prefix match ranks higher than contains match", () => {
		const result = filterByRelevance(items, "frontend");
		expect(result[0]?.name).toBe("frontend-app");
		expect(result[1]?.name).toBe("frontend-admin");
	});

	it("filters by path as well as name", () => {
		const result = filterByRelevance(items, "admin");
		expect(result.some((r) => r.name === "frontend-admin")).toBe(true);
	});

	it("returns empty array for no matches", () => {
		const result = filterByRelevance(items, "nonexistent");
		expect(result).toEqual([]);
	});

	it("case-insensitive matching", () => {
		const result = filterByRelevance(items, "FRONTEND");
		expect(result.length).toBeGreaterThan(0);
	});
});
