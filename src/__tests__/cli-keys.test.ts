import { describe, expect, it } from "vitest";
import en from "../i18n/locales/en.json";
import zhCN from "../i18n/locales/zh-CN.json";

// New CLI keys added in the i18n improvements
const requiredCliKeys = [
	"stopDesc",
	"restartDesc",
	"releaseOpenDesc",
	"endOpenDesc",
	"mrOpenDesc",
	"watchOpenDesc",
	"configOpenDesc",
	"projectsLoaded",
	"branchesLoaded",
	"jiraProjectsLoaded",
	"noExistingIssue",
	"mrExisting",
	"jiraCommentTemplate",
] as const;

describe("CLI i18n keys", () => {
	it.each(requiredCliKeys)("zh-CN has cli.%s", (key) => {
		expect(zhCN.cli[key]).toBeTypeOf("string");
		expect(zhCN.cli[key]).not.toBe("");
	});

	it.each(requiredCliKeys)("en has cli.%s", (key) => {
		expect(en.cli[key]).toBeTypeOf("string");
		expect(en.cli[key]).not.toBe("");
	});

	it("stopDesc and restartDesc are different from serveDesc", () => {
		expect(zhCN.cli.stopDesc).not.toBe(zhCN.cli.serveDesc);
		expect(zhCN.cli.restartDesc).not.toBe(zhCN.cli.serveDesc);
		expect(zhCN.cli.stopDesc).not.toBe(zhCN.cli.restartDesc);

		expect(en.cli.stopDesc).not.toBe(en.cli.serveDesc);
		expect(en.cli.restartDesc).not.toBe(en.cli.serveDesc);
		expect(en.cli.stopDesc).not.toBe(en.cli.restartDesc);
	});

	it("all --open descriptions are unique", () => {
		const zhDescs = [
			zhCN.cli.configOpenDesc,
			zhCN.cli.releaseOpenDesc,
			zhCN.cli.endOpenDesc,
			zhCN.cli.mrOpenDesc,
			zhCN.cli.watchOpenDesc,
		];
		const uniqueZhDescs = new Set(zhDescs);
		expect(uniqueZhDescs.size).toBe(5);

		const enDescs = [
			en.cli.configOpenDesc,
			en.cli.releaseOpenDesc,
			en.cli.endOpenDesc,
			en.cli.mrOpenDesc,
			en.cli.watchOpenDesc,
		];
		const uniqueEnDescs = new Set(enDescs);
		expect(uniqueEnDescs.size).toBe(5);
	});
});
