import fs from "node:fs";
import { CONFIG_PATH, DATA_DIR, OLD_CONFIG_PATH } from "./constants";
import type { Config } from "./types";

type Key = keyof Config;

export class ConfigJson {
	private config: Config;

	constructor() {
		this.config = ConfigJson.read();
	}

	private static ensureDir() {
		if (!fs.existsSync(DATA_DIR)) {
			fs.mkdirSync(DATA_DIR, { recursive: true });
		}
	}

	private static migrateOldConfig() {
		if (fs.existsSync(CONFIG_PATH)) return;
		if (!fs.existsSync(OLD_CONFIG_PATH)) return;
		ConfigJson.ensureDir();
		try {
			const oldConfig = JSON.parse(fs.readFileSync(OLD_CONFIG_PATH, "utf-8"));
			fs.writeFileSync(CONFIG_PATH, JSON.stringify(oldConfig, null, 2));
			fs.unlinkSync(OLD_CONFIG_PATH);
		} catch {
			// migration failed — just proceed with empty config
		}
	}

	private static read(): Config {
		ConfigJson.migrateOldConfig();
		try {
			if (fs.existsSync(CONFIG_PATH)) {
				return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
			}
		} catch {
			// corrupt or unreadable — fall through to default
		}
		return {};
	}

	private persist() {
		ConfigJson.ensureDir();
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
	}

	getConfig(): Config {
		return this.config;
	}

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
