import { spawn } from "node:child_process";
import pc from "picocolors";
import { t } from "../../i18n/cli";
import { restartServerInBackground } from "../../server";

export const updateAction = async () => {
	console.log(`${pc.cyan("↻")} ${t("cli.updating")}`);

	const code = await new Promise<number>((resolve) => {
		const child = spawn("npm", ["update", "-g", "flowpilot"], {
			stdio: "inherit",
		});
		child.on("close", (exitCode) => resolve(exitCode ?? 1));
		child.on("error", (err) => {
			console.error(`${pc.red("✘")} ${err.message}`);
			resolve(1);
		});
	});

	if (code === 0) {
		await restartServerInBackground();
		console.log(`${pc.green("✔")} ${t("cli.updateSuccess")}`);
	} else {
		console.error(`${pc.red("✘")} ${t("cli.updateFailed")}`);
		process.exit(1);
	}
};
