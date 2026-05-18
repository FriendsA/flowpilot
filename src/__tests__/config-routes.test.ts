import { beforeEach, describe, expect, it, vi } from "vitest";
import { configRoutes } from "../commands/config/routes";

// Mock i18n/web
vi.mock("../i18n/web", () => ({
	t: (key: string) => key,
	initI18n: vi.fn().mockResolvedValue(undefined),
	detectLocaleFromCookie: vi.fn().mockReturnValue(null),
	detectLocaleFromHeader: vi.fn().mockReturnValue("zh-CN"),
	getLocaleResources: vi.fn().mockReturnValue({ translation: {} }),
}));

// Mock Layout
vi.mock("../shared/layout", () => ({
	Layout: ({ children }: { children: string }) => children,
}));

// Use vi.hoisted for mock functions referenced in vi.mock factories
const { mockGetConfig, mockSetConfig } = vi.hoisted(() => ({
	mockGetConfig: vi.fn(),
	mockSetConfig: vi.fn(),
}));

vi.mock("../config", () => ({
	ConfigJson: class {
		getConfig = mockGetConfig;
		setConfig = mockSetConfig;
	},
}));

const app = configRoutes;

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------
describe("Config routes – GET /", () => {
	it("renders the config page", async () => {
		mockGetConfig.mockReturnValue({});
		const res = await app.fetch(new Request("http://localhost/"));
		expect(res.status).toBe(200);
	});
});

// ---------------------------------------------------------------------------
// GET /api/config
// ---------------------------------------------------------------------------
describe("Config routes – GET /api/config", () => {
	it("returns full config", async () => {
		mockGetConfig.mockReturnValue({
			jiraHost: "https://jira.com",
			jiraName: "user",
			jiraPassword: "pass",
			gitlabHost: "https://gitlab.com",
			gitlabKey: "token",
		});
		const res = await app.fetch(new Request("http://localhost/api/config"));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({
			jiraHost: "https://jira.com",
			jiraName: "user",
			jiraPassword: "pass",
			gitlabHost: "https://gitlab.com",
			gitlabKey: "token",
		});
	});

	it("returns empty object when config missing", async () => {
		mockGetConfig.mockReturnValue({});
		const res = await app.fetch(new Request("http://localhost/api/config"));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// POST /api/config
// ---------------------------------------------------------------------------
describe("Config routes – POST /api/config", () => {
	it("saves config and returns ok", async () => {
		mockSetConfig.mockImplementationOnce(() => {});
		const res = await app.fetch(
			new Request("http://localhost/api/config", {
				method: "POST",
				body: JSON.stringify({
					jiraHost: "https://jira.com",
					jiraName: "user",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ ok: true });
		expect(mockSetConfig).toHaveBeenCalledWith({
			jiraHost: "https://jira.com",
			jiraName: "user",
		});
	});

	it("saves empty config", async () => {
		mockSetConfig.mockImplementationOnce(() => {});
		const res = await app.fetch(
			new Request("http://localhost/api/config", {
				method: "POST",
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(200);
		expect(mockSetConfig).toHaveBeenCalledWith({});
	});

	it("saves partial config (only gitlab fields)", async () => {
		mockSetConfig.mockImplementationOnce(() => {});
		const res = await app.fetch(
			new Request("http://localhost/api/config", {
				method: "POST",
				body: JSON.stringify({
					gitlabHost: "https://gitlab.com",
					gitlabKey: "token",
				}),
			}),
		);
		expect(res.status).toBe(200);
		expect(mockSetConfig).toHaveBeenCalledWith({
			gitlabHost: "https://gitlab.com",
			gitlabKey: "token",
		});
	});
});
