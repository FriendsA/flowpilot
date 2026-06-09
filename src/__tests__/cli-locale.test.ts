import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectLocaleFromEnv } from "../i18n/cli";

describe("detectLocaleFromEnv", () => {
	const originalLang = process.env.LANG;
	const originalLcAll = process.env.LC_ALL;
	const originalLcMessages = process.env.LC_MESSAGES;

	beforeEach(() => {
		delete process.env.LANG;
		delete process.env.LC_ALL;
		delete process.env.LC_MESSAGES;
	});

	afterEach(() => {
		process.env.LANG = originalLang;
		process.env.LC_ALL = originalLcAll;
		process.env.LC_MESSAGES = originalLcMessages;
	});

	it("returns en-US for en_US.UTF-8 (underscore format)", () => {
		process.env.LANG = "en_US.UTF-8";
		expect(detectLocaleFromEnv()).toBe("en-US");
	});

	it("returns en-US for en-US (hyphen format)", () => {
		process.env.LANG = "en-US";
		expect(detectLocaleFromEnv()).toBe("en-US");
	});

	it("returns zh-CN for zh_CN.UTF-8", () => {
		process.env.LANG = "zh_CN.UTF-8";
		expect(detectLocaleFromEnv()).toBe("zh-CN");
	});

	it("returns zh-CN when no env vars are set", () => {
		expect(detectLocaleFromEnv()).toBe("zh-CN");
	});

	it("prioritizes LANG over LC_ALL", () => {
		process.env.LANG = "fr_FR.UTF-8";
		process.env.LC_ALL = "en_US.UTF-8";
		// Note: fr-FR is not in SUPPORTED_LOCALES, but detectLocaleFromEnv just parses format
		expect(detectLocaleFromEnv()).toBe("fr-FR");
	});

	it("handles invalid format gracefully", () => {
		process.env.LANG = "invalid";
		expect(detectLocaleFromEnv()).toBe("zh-CN");
	});
});
