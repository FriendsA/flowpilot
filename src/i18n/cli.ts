import i18next from "i18next";
import { ConfigJson } from "../config";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

const SUPPORTED_LOCALES = ["zh-CN", "en"];

/**
 * Detects the locale from environment variables (LANG, LC_ALL, LC_MESSAGES).
 * Supports both `en-US` and `en_US` formats, with optional `.UTF-8` suffix.
 * Falls back to `zh-CN` if no valid locale is found.
 */
export function detectLocaleFromEnv(): string {
	const lang =
		process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || "";
	const match = lang.match(/^([a-z]{2})[_-]([A-Z]{2})/i);
	if (match?.[1] && match?.[2]) {
		return `${match[1]}-${match[2]}`;
	}
	return "zh-CN";
}

function detectLocale(): string {
	const configLocale = new ConfigJson().get("locale");
	if (configLocale && SUPPORTED_LOCALES.includes(configLocale))
		return configLocale;
	return detectLocaleFromEnv();
}

i18next.init({
	lng: detectLocale(),
	fallbackLng: "zh-CN",
	resources: {
		en: { translation: en },
		"zh-CN": { translation: zhCN },
	},
	interpolation: { escapeValue: false },
});

export const t = i18next.t;
