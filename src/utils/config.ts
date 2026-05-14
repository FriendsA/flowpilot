import pc from "picocolors";
import { ConfigJson } from "../config";
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
			pc.red("Missing configuration:") +
				" " +
				missing.map((k) => pc.bold(k)).join(", "),
		);
		console.error(pc.dim("Run `flowpilot config` to set these values."));
		return false;
	}

	return true;
}