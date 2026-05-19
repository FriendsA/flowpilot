import { describe, expect, it } from "vitest";
import en from "../i18n/locales/en.json";
import zhCN from "../i18n/locales/zh-CN.json";

const requiredEndKeys = [
	"projectPath",
	"enterPath",
	"setPath",
	"pathNotGitRepo",
	"rerun",
	"copy",
	"stepBranch",
	"stepRebase",
	"stepPush",
	"stepTickets",
	"stepMR",
	"stepJira",
	"rebaseBtn",
	"pushBtn",
	"rebaseResult",
	"pushResult",
	"conflictWarning",
	"ticketKeys",
	"createMrBtn",
	"mrUrl",
	"copied",
	"transitionBtn",
	"transitionSuccess",
	"detectedSource",
	"skipMr",
	"skipJira",
] as const;

describe("end page i18n", () => {
	it.each(requiredEndKeys)("defines zh-CN translation for end.%s", (key) => {
		expect(zhCN.end[key]).toBeTypeOf("string");
		expect(zhCN.end[key]).not.toBe("");
		expect(zhCN.end[key]).not.toBe(`end.${key}`);
	});

	it.each(requiredEndKeys)("defines en translation for end.%s", (key) => {
		expect(en.end[key]).toBeTypeOf("string");
		expect(en.end[key]).not.toBe("");
		expect(en.end[key]).not.toBe(`end.${key}`);
	});
});
