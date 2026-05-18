import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExistsSync, mockReadFileSync, mockWriteFileSync } = vi.hoisted(
	() => ({
		mockExistsSync: vi.fn(),
		mockReadFileSync: vi.fn(),
		mockWriteFileSync: vi.fn(),
	}),
);

vi.mock("node:fs", () => ({
	default: {
		existsSync: mockExistsSync,
		readFileSync: mockReadFileSync,
		writeFileSync: mockWriteFileSync,
	},
	existsSync: mockExistsSync,
	readFileSync: mockReadFileSync,
	writeFileSync: mockWriteFileSync,
}));

vi.mock("node:os", () => ({
	default: { homedir: () => "/test/home" },
	homedir: () => "/test/home",
}));

vi.mock("../constants", () => ({
	CONFIG_PATH: "/test/home/.flowpilotrc",
	PORT: 8787,
	SERVER_URL: "http://127.0.0.1:8787",
	PID_FILE: "/test/home/.flowpilot.pid",
	VERSION: "0.0.1",
}));

import { ConfigJson } from "../config";

const NEW_PATH = "/test/home/.flowpilotrc";

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------
describe("ConfigJson – read", () => {
	it("returns empty object when config file missing", () => {
		mockExistsSync.mockReturnValue(false);
		const cfg = new ConfigJson();
		expect(cfg.getConfig()).toEqual({});
	});

	it("reads valid JSON from config file", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(
			JSON.stringify({ jiraHost: "https://jira.com" }),
		);
		const cfg = new ConfigJson();
		expect(cfg.getConfig()).toEqual({ jiraHost: "https://jira.com" });
	});

	it("migrates from old .workflowrc when new file missing", () => {
		mockExistsSync
			.mockReturnValueOnce(false) // new path not found
			.mockReturnValueOnce(true); // old path found
		mockReadFileSync.mockReturnValue(
			JSON.stringify({ jiraHost: "https://jira.com" }),
		);
		const cfg = new ConfigJson();
		expect(cfg.getConfig()).toEqual({ jiraHost: "https://jira.com" });
		expect(mockWriteFileSync).toHaveBeenCalledWith(
			NEW_PATH,
			JSON.stringify({ jiraHost: "https://jira.com" }),
		);
	});

	it("returns empty object on corrupt JSON", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue("not-json{{{");
		const cfg = new ConfigJson();
		expect(cfg.getConfig()).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// get / set
// ---------------------------------------------------------------------------
describe("ConfigJson – get", () => {
	it("returns value for existing key", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(
			JSON.stringify({ jiraHost: "https://jira.com" }),
		);
		const cfg = new ConfigJson();
		expect(cfg.get("jiraHost")).toBe("https://jira.com");
	});

	it("returns undefined for missing key", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(
			JSON.stringify({ jiraHost: "https://jira.com" }),
		);
		const cfg = new ConfigJson();
		expect(cfg.get("gitlabHost")).toBeUndefined();
	});
});

describe("ConfigJson – set", () => {
	it("sets a single key and persists", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(
			JSON.stringify({ jiraHost: "https://jira.com" }),
		);
		const cfg = new ConfigJson();
		cfg.set("gitlabHost", "https://gitlab.com");
		expect(cfg.get("gitlabHost")).toBe("https://gitlab.com");
		expect(cfg.get("jiraHost")).toBe("https://jira.com");
		expect(mockWriteFileSync).toHaveBeenCalledWith(
			NEW_PATH,
			JSON.stringify({
				jiraHost: "https://jira.com",
				gitlabHost: "https://gitlab.com",
			}),
		);
	});
});

describe("ConfigJson – setConfig", () => {
	it("merges partial config and persists", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(
			JSON.stringify({ jiraHost: "https://jira.com" }),
		);
		const cfg = new ConfigJson();
		cfg.setConfig({ gitlabHost: "https://gitlab.com", gitlabKey: "token123" });
		const config = cfg.getConfig();
		expect(config).toEqual({
			jiraHost: "https://jira.com",
			gitlabHost: "https://gitlab.com",
			gitlabKey: "token123",
		});
		expect(mockWriteFileSync).toHaveBeenCalledWith(
			NEW_PATH,
			JSON.stringify(config),
		);
	});

	it("overwrites existing keys", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(
			JSON.stringify({ jiraHost: "https://old.jira.com" }),
		);
		const cfg = new ConfigJson();
		cfg.setConfig({ jiraHost: "https://new.jira.com" });
		expect(cfg.get("jiraHost")).toBe("https://new.jira.com");
	});
});
