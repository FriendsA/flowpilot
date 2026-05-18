import cac from "cac";
import pc from "picocolors";
import { configAction, endAction, releaseAction } from "./commands";
import { VERSION } from "./constants";
import { t } from "./i18n/cli";
import {
	restartServerInBackground,
	startServerInBackground,
	stopServer,
} from "./server";

// Gracefully handle Ctrl+C during interactive prompts
// @inquirer/search throws ExitPromptError on SIGINT instead of returning cancel
process.on("uncaughtException", (err) => {
	if (err.name === "ExitPromptError") {
		console.log(pc.dim("\n已取消。"));
		process.exit(0);
	}
	throw err;
});

const cli = cac("flowpilot");

cli
	.command("config", t("cli.configDesc"))
	.option("-o, --open", t("cli.configOpenDesc"))
	.action(configAction);

cli
	.command("release", t("cli.releaseDesc"))
	.option("-o, --open", t("cli.configOpenDesc"))
	.action(releaseAction);

cli
	.command("end", t("cli.endDesc"))
	.option("-b, --branch <branch>", t("cli.endBranchDesc"))
	.option("-o, --open", t("cli.configOpenDesc"))
	.action(endAction);

cli.command("serve", t("cli.serveDesc")).action(async () => {
	await startServerInBackground();
	console.log(pc.green("✔") + ` ${t("cli.serveStarted")}`);
});

cli.command("stop", t("cli.serveDesc")).action(() => {
	if (stopServer()) {
		console.log(pc.green("✔") + ` ${t("cli.serveStopped")}`);
	} else {
		console.log(pc.yellow("⚠") + ` ${t("cli.noRunningService")}`);
	}
});

cli.command("restart", t("cli.serveDesc")).action(async () => {
	await restartServerInBackground();
	console.log(pc.green("✔") + ` ${t("cli.serveRestarted")}`);
});

cli.help();
cli.version(VERSION);
cli.parse();
