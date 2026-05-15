import cac from "cac";
import pc from "picocolors";
import { configAction, releaseAction, updateAction } from "./commands";
import { VERSION } from "./constants";
import { t } from "./i18n/cli";
import {
  restartServerInBackground,
  startServerInBackground,
  stopServer,
} from "./server";

const cli = cac("flowpilot");

cli
  .command("config", t("cli.configDesc"))
  .option("-o, --open", t("cli.configOpenDesc"))
  .action(configAction);

cli
  .command("release", t("cli.releaseDesc"))
  .option("-o, --open", t("cli.configOpenDesc"))
  .action(releaseAction);

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

cli.command("update", t("cli.updateDesc")).action(updateAction);

cli.help();
cli.version(VERSION);
cli.parse();
