import cac from "cac";
import pc from "picocolors";
import { configAction, releaseAction } from "./commands";
import { VERSION } from "./constants";
import {
  restartServerInBackground,
  startServerInBackground,
  stopServer,
} from "./server";

const cli = cac("flowpilot");

cli
  .command("config", "配置账号信息")
  .option("-o, --open", "打开页面操作")
  .action(configAction);

cli
  .command("release", "创建发布申请")
  .option("-o, --open", "打开页面操作")
  .action(releaseAction);

cli.command("serve", "启动后台服务").action(async () => {
  await startServerInBackground();
  console.log(pc.green("✔") + " 服务已启动");
});

cli.command("stop", "停止后台服务").action(() => {
  if (stopServer()) {
    console.log(pc.green("✔") + " 服务已停止");
  } else {
    console.log(pc.yellow("⚠") + " 没有正在运行的服务");
  }
});

cli.command("restart", "重启后台服务").action(async () => {
  await restartServerInBackground();
  console.log(pc.green("✔") + " 服务已重启");
});

cli.help();
cli.version(VERSION);
cli.parse();
