import { spawn } from "node:child_process";
import pc from "picocolors";
import { t } from "../../i18n/cli";
import { restartServerInBackground } from "../../server";

export const updateAction = async () => {
	console.log(pc.cyan("↻") + ` ${t("cli.updating")}`);

	const child = spawn("npm", ["update", "-g", "flowpilot"], {
		stdio: "inherit",
	});

	child.on("close", async (code) => {
		if (code === 0) {
			await restartServerInBackground();
			console.log(pc.green("✔") + ` ${t("cli.updateSuccess")}`);
		} else {
			console.error(pc.red("✘") + ` ${t("cli.updateFailed")}`);
			process.exit(1);
		}
	});
};