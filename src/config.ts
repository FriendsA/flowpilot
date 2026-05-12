import fs from "node:fs";
import { CONFIG_PATH } from "./constants";
import type { Config } from "./types";

type Key = keyof Config;

export class ConfigJson {
  private config: Config | undefined;
  constructor(init?: Config) {
    this.initial(init);
  }

  private initial(init?: Config) {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH).toString());
        this.config = config;
      }
      if (init) {
        this.config = { ...this.config, ...init };
      }
      if (this.config) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config));
      }
    } catch (e) {
      // TODO: 提示错误
      console.error(e);
    }
  }

  getConfig() {
    return this.config || {};
  }

  setConfig(init?: Config) {
    this.initial(init);
  }

  get(key: Key) {
    if (this.config) return this.config?.[key];
  }

  set(key: Key, value: string) {
    if (!this.config) this.config = {} as Config;
    this.config[key] = value;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config));
  }

  static from(init?: Config) {
    return new ConfigJson(init);
  }
}
