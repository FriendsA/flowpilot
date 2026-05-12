import { exec, spawn } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { configPage } from "./commands";
import { ConfigJson } from "./config";
import { PID_FILE, PORT, SERVER_URL } from "./constants";

const app = new Hono();

app.get("/config", (c) => {
  const config = new ConfigJson();
  return c.html(configPage(config.getConfig() ?? {}));
});

app.post("/config", async (c) => {
  const body = await c.req.parseBody();
  const config = new ConfigJson();
  config.setConfig({
    jiraName: String(body.jiraName ?? ""),
    jiraPassword: String(body.jiraPassword ?? ""),
    gitlabKey: String(body.gitlabKey ?? ""),
  });
  return c.html(configPage(config.getConfig() ?? {}, true));
});

export const startServer = () => {
  return serve({
    fetch: app.fetch,
    port: PORT,
  });
};

export const isPortInUse = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
};

export const startServerInBackground = async () => {
  if (await isPortInUse(PORT)) return;

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const serverPath = join(__dirname, "serve.js");

  const child = spawn("node", [serverPath], {
    detached: true,
    stdio: "ignore",
  });

  if (child.pid) {
    fs.writeFileSync(PID_FILE, String(child.pid));
  }

  child.unref();
};

export const stopServer = (): boolean => {
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }

  const pid = Number(fs.readFileSync(PID_FILE, "utf-8").trim());

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // process already dead
  }

  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // file already removed
  }

  return true;
};

export const restartServerInBackground = async () => {
  stopServer();
  // wait a bit for the port to be released
  await new Promise((r) => setTimeout(r, 300));
  await startServerInBackground();
};

export const openBrowser = (url: string) => {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${cmd} ${url}`);
};

export const openPage = async (path: string) => {
  await startServerInBackground();
  openBrowser(`${SERVER_URL}${path}`);
};
