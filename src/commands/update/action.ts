import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pc from "picocolors";
import { VERSION } from "../../constants";
import { t } from "../../i18n/cli";
import { restartServerInBackground, stopServer } from "../../server";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

async function getLatestVersion(): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const child = spawn("npm", ["view", "flowpilot", "version"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
		child.on("error", reject);
		child.on("close", (code) =>
			code === 0
				? resolve(stdout.trim())
				: reject(new Error("npm view failed")),
		);
	});
}

async function checkWritePermission(): Promise<boolean> {
	try {
		const prefixRaw = await new Promise<string>((resolve, reject) => {
			const child = spawn("npm", ["config", "get", "prefix"], {
				stdio: ["ignore", "pipe", "pipe"],
			});
			let out = "";
			child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
			child.on("error", reject);
			child.on("close", (code) =>
				code === 0 ? resolve(out.trim()) : reject(),
			);
		});
		const globalDir = path.join(prefixRaw, "lib", "node_modules");
		fs.accessSync(globalDir, fs.constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

function showPermissionHint(): void {
	console.log(`\n${pc.red("✘")} ${t("cli.permissionDenied")}\n`);
	console.log(`${pc.yellow("💡")} ${pc.bold(t("cli.permissionHint"))}`);
	if (os.platform() === "win32") {
		console.log(`  ${t("cli.permissionHintWin32")}`);
	} else {
		console.log(`  ${t("cli.permissionHintUnix")}`);
	}
	process.exit(1);
}

function startSpinner(text: string): { stop: (finalText: string) => void } {
	let frame = 0;
	const stream = process.stdout;
	const render = () => {
		stream.write(
			`\r${pc.cyan(SPINNER_FRAMES[frame % SPINNER_FRAMES.length])} ${text}`,
		);
		frame++;
	};
	render();
	const interval = setInterval(render, 80);
	return {
		stop(finalText) {
			clearInterval(interval);
			stream.write(`\r\x1b[K${finalText}\n`);
		},
	};
}

export const updateAction = async () => {
	// Phase 1: Show local version
	console.log(`${pc.cyan("flowpilot")} ${pc.gray(`v${VERSION}`)}\n`);

	// Phase 2: Check latest version
	const spinner1 = startSpinner(t("cli.checkingUpdate"));
	let latest: string;
	try {
		latest = await getLatestVersion();
	} catch {
		spinner1.stop(`${pc.red("✘")} ${t("cli.checkUpdateFailed")}`);
		console.log(`\n${pc.dim(t("cli.networkErrorHint"))}`);
		process.exit(1);
	}

	if (latest === VERSION) {
		spinner1.stop(
			`${pc.green("✔")} ${t("cli.alreadyLatestVersion", { version: VERSION })}`,
		);
		process.exit(0);
	}

	spinner1.stop(
		`${pc.green("✔")} ${t("cli.foundNewVersion", { version: latest })}`,
	);
	console.log(
		pc.dim(t("cli.versionTransition", { from: VERSION, to: latest })),
	);
	console.log("");

	// Phase 3: Check write permissions
	const hasAccess = await checkWritePermission();
	if (!hasAccess) {
		showPermissionHint();
	}

	// Phase 4: Stop server before update to release file locks
	const spinner2 = startSpinner(t("cli.stoppingService"));
	try {
		stopServer();
		spinner2.stop(`${pc.green("✔")} ${t("cli.serviceStopped")}`);
	} catch {
		spinner2.stop(`${pc.yellow("⚠")} ${t("cli.stopServiceFailed")}`);
	}

	// Phase 5: Execute update with captured stdio (no raw npm noise)
	const spinner3 = startSpinner(t("cli.updating"));
	const updateResult = await new Promise<{ code: number; stderr: string }>(
		(resolve) => {
			const child = spawn("npm", ["update", "-g", "flowpilot"], {
				stdio: ["ignore", "pipe", "pipe"],
			});
			let stderr = "";
			child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
			child.on("error", () => resolve({ code: 1, stderr: "" }));
			child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
		},
	);

	if (updateResult.code !== 0) {
		spinner3.stop(`${pc.red("✘")} ${t("cli.updateFailed")}`);
		if (updateResult.stderr.trim()) {
			console.error(`\n${pc.dim(updateResult.stderr.trim())}`);
		}
		process.exit(1);
	}
	spinner3.stop(`${pc.green("✔")} ${t("cli.updateSuccess")}`);

	// Phase 6: Restart service
	const spinner4 = startSpinner(t("cli.restartingService"));
	try {
		await restartServerInBackground();
		spinner4.stop(`${pc.green("✔")} ${t("cli.serviceRestarted")}`);
	} catch {
		spinner4.stop(`${pc.yellow("⚠")} ${t("cli.restartServiceFailed")}`);
	}
};
