import pc from "picocolors";
import { ConfigJson } from "../config";
import { t } from "../i18n/cli";
import type { Config } from "../types";

const REQUIRED_KEYS: (keyof Config)[] = [
	"jiraHost",
	"jiraName",
	"jiraPassword",
	"gitlabHost",
	"gitlabKey",
];

export function validateConfigOrWarn(): boolean {
	const config = new ConfigJson().getConfig();
	const missing = REQUIRED_KEYS.filter((key) => !config[key]);

	if (missing.length > 0) {
		console.error(
			pc.red(t("error.configMissing")) +
				" " +
				missing.map((k) => pc.bold(k)).join(", "),
		);
		console.error(pc.dim(t("error.runConfig")));
		return false;
	}

	return true;
}