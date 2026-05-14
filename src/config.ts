import fs from "node:fs";
import os from "node:os";
import { CONFIG_PATH } from "./constants";
import type { Config } from "./types";

type Key = keyof Config;

const OLD_CONFIG_PATH = `${os.homedir()}/.workflowrc`;

export class ConfigJson {
	private config: Config;

	constructor() {
		this.config = ConfigJson.read();
	}

	/** Read config from disk. Returns empty object if file missing or invalid. */
	private static read(): Config {
		try {
			if (fs.existsSync(CONFIG_PATH)) {
				return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
			}
			// Migration: copy old config if new one doesn't exist
			if (fs.existsSync(OLD_CONFIG_PATH)) {
				const oldConfig = JSON.parse(fs.readFileSync(OLD_CONFIG_PATH, "utf-8"));
				fs.writeFileSync(CONFIG_PATH, JSON.stringify(oldConfig));
				return oldConfig;
			}
		} catch {
			// corrupt or unreadable — fall through to default
		}
		return {};
	}

	/** Write current config to disk. */
	private persist() {
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config));
	}

	getConfig(): Config {
		return this.config;
	}

	/** Merge partial config into current and persist. */
	setConfig(patch: Config) {
		this.config = { ...this.config, ...patch };
		this.persist();
	}

	get<K extends Key>(key: K): Config[K] | undefined {
		return this.config[key];
	}

	set<K extends Key>(key: K, value: NonNullable<Config[K]>) {
		this.config[key] = value;
		this.persist();
	}
}