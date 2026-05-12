import cac from "cac";
import { configAction } from "./commands";
import { VERSION } from "./constants";
import {
  restartServerInBackground,
  startServerInBackground,
  stopServer,
} from "./server";

const cli = cac("workflow");

cli
  .command("config", "配置账号信息")
  .option("-o, --open", "打开页面操作")
  .action(configAction);

cli.command("serve", "启动后台服务").action(async () => {
  await startServerInBackground();
  console.log("服务已启动");
});

cli.command("stop", "停止后台服务").action(() => {
  if (stopServer()) {
    console.log("服务已停止");
  } else {
    console.log("没有正在运行的服务");
  }
});

cli.command("restart", "重启后台服务").action(async () => {
  await restartServerInBackground();
  console.log("服务已重启");
});

cli.help();
cli.version(VERSION);
cli.parse();
