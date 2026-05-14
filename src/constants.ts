import fs from "node:fs";
import os from "node:os";

const { version } = JSON.parse(
	fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);

export const VERSION = version;

export const CONFIG_PATH = `${os.homedir()}/.flowpilotrc`;

export const PORT = 8787;

export const SERVER_URL = `http://127.0.0.1:${PORT}`;

export const PID_FILE = `${os.homedir()}/.flowpilot.pid`;

