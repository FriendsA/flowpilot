import { spawn } from "node:child_process";
import cac from "cac";
import pc from "picocolors";
import {
	configAction,
	endAction,
	mrAction,
	releaseAction,
	updateAction,
	watchAction,
} from "./commands";
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
	.option("-o, --open", t("cli.releaseOpenDesc"))
	.action(releaseAction);

cli
	.command("end", t("cli.endDesc"))
	.option("-b, --branch <branch>", t("cli.endBranchDesc"))
	.option("-o, --open", t("cli.endOpenDesc"))
	.action(endAction);

cli
	.command("mr", t("cli.mrDesc"))
	.option("-t, --target <branch>", t("cli.mrTargetDesc"))
	.option("-o, --open", t("cli.mrOpenDesc"))
	.option("--draft", t("cli.mrDraftDesc"))
	.action(mrAction);

cli
	.command("watch", t("cli.watchDesc"))
	.option("-o, --open", t("cli.watchOpenDesc"))
	.action(watchAction);

cli.command("serve", t("cli.serveDesc")).action(async () => {
	await startServerInBackground();
	console.log(`${pc.green("✔")} ${t("cli.serveStarted")}`);
});

cli.command("stop", t("cli.stopDesc")).action(() => {
	if (stopServer()) {
		console.log(`${pc.green("✔")} ${t("cli.serveStopped")}`);
	} else {
		console.log(`${pc.yellow("⚠")} ${t("cli.noRunningService")}`);
	}
});

cli.command("restart", t("cli.restartDesc")).action(async () => {
	await restartServerInBackground();
	console.log(`${pc.green("✔")} ${t("cli.serveRestarted")}`);
});

cli.command("update", t("cli.updateDesc")).action(updateAction);

cli.help();

if (process.argv.includes("-v") || process.argv.includes("--version")) {
	console.log(`${pc.cyan("flowpilot")} ${pc.green(`v${VERSION}`)}`);
	const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	let i = 0;
	const spinnerInterval = setInterval(() => {
		process.stdout.write(
			`\r${pc.cyan(spinner[i % spinner.length])} ${t("cli.checkingUpdate")}`,
		);
		i++;
	}, 80);
	let latest = "";
	try {
		latest = await new Promise<string>((resolve, reject) => {
			const child = spawn("npm", ["view", "flowpilot", "version"], {
				stdio: ["ignore", "pipe", "ignore"],
				timeout: 3000,
			});
			let stdout = "";
			child.stdout?.on("data", (d) => (stdout += d));
			child.on("error", reject);
			child.on("close", (code) =>
				code === 0 ? resolve(stdout.trim()) : reject(new Error()),
			);
		});
	} catch {}
	clearInterval(spinnerInterval);
	process.stdout.write("\r\x1b[K");
	if (latest && latest !== VERSION) {
		console.log(
			`${pc.yellow("↻")} ${t("cli.updateAvailable", { current: VERSION, latest })}`,
		);
		console.log(pc.dim(`  → flowpilot update`));
	} else if (latest) {
		console.log(`${pc.green("✔")} ${t("cli.alreadyLatest")}`);
	}
	process.exit(0);
}

try {
	cli.parse();
} catch (err) {
	if (err instanceof Error) {
		const isCacError = err.name === "CACError" || err.message?.includes("Unknown option");
		if (isCacError) {
			console.error(pc.red(`✘ ${err.message}`));
			console.error(pc.dim(`\n运行 ${pc.cyan("flowpilot --help")} 查看所有可用命令和选项`));
			process.exit(1);
		}
	}
	throw err;
}
