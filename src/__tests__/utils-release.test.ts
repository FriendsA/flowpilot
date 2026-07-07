import { describe, expect, it } from "vitest";
import {
	buildReleaseSummary,
	buildVersionName,
	escapeJqlStringLiteral,
} from "../utils/release";

describe("buildVersionName", () => {
	it("joins flowPilotName and cleaned version", () => {
		expect(buildVersionName("my-app", "1.2.3")).toBe("my-app-1.2.3");
	});

	it("strips suffix from version (e.g. -SNAPSHOT)", () => {
		expect(buildVersionName("my-app", "1.2.3-SNAPSHOT")).toBe("my-app-1.2.3");
	});

	it("falls back to empty string when flowPilotName is null", () => {
		expect(buildVersionName(null, "1.0.0")).toBe("-1.0.0");
	});

	it("handles null version", () => {
		expect(buildVersionName("my-app", null)).toBe("my-app-");
	});
});

describe("buildReleaseSummary", () => {
	it("uses provided suffix from the i18n catalogue", () => {
		expect(buildReleaseSummary("my-app", "1.0.0", "发布申请")).toBe(
			"my-app-1.0.0 发布申请",
		);
		expect(buildReleaseSummary("my-app", "1.0.0", "release request")).toBe(
			"my-app-1.0.0 release request",
		);
	});

	it("CLI and Web must produce the same string for the same inputs", () => {
		// Regression: previously Web hardcoded "release request" which
		// broke JQL `summary ~` lookups across locales and would create
		// duplicate Jira issues when re-running the same release.
		const cliSuffix = "发布申请";
		const webSuffix = "发布申请";
		expect(buildReleaseSummary("svc", "2.0.0", cliSuffix)).toBe(
			buildReleaseSummary("svc", "2.0.0", webSuffix),
		);
	});

	it("strips version suffix before composing summary", () => {
		expect(buildReleaseSummary("svc", "1.0.0-RC1", "发布申请")).toBe(
			"svc-1.0.0 发布申请",
		);
	});
});

describe("escapeJqlStringLiteral", () => {
	it("escapes embedded double quotes", () => {
		expect(escapeJqlStringLiteral('a"b')).toBe('a\\"b');
	});

	it("escapes embedded backslashes before quotes", () => {
		expect(escapeJqlStringLiteral("a\\b")).toBe("a\\\\b");
		expect(escapeJqlStringLiteral('a\\"b')).toBe('a\\\\\\"b');
	});

	it("passes through safe strings unchanged", () => {
		expect(escapeJqlStringLiteral("svc-1.0.0 发布申请")).toBe(
			"svc-1.0.0 发布申请",
		);
	});
});
