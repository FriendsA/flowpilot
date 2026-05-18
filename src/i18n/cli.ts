import i18next from "i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

function detectLocale(): string {
	const lang =
		process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || "";
	const match = lang.match(/^([a-z]{2}-[A-Z]{2})/i);
	if (match?.[1]) return match[1];
	return "zh-CN";
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
