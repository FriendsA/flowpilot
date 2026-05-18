import fs from "node:fs";
import os from "node:os";

const { version } = JSON.parse(
	fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);

export const VERSION = version;
export const DATA_DIR = `${os.homedir()}/.flowpilot`;
export const HISTORY_DIR = `${DATA_DIR}/history`;
export const CONFIG_PATH = `${DATA_DIR}/config.json`;
export const PID_FILE = `${DATA_DIR}/pid.json`;
export const PORT = 8787;
export const SERVER_URL = `http://127.0.0.1:${PORT}`;

// Old paths for migration
export const OLD_CONFIG_PATH = `${os.homedir()}/.flowpilotrc`;
export const OLD_PID_FILE = `${os.homedir()}/.flowpilot.pid`;
