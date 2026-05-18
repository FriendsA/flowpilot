import i18next from "i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

export type Locale = "zh-CN" | "en";

const SUPPORTED: Locale[] = ["zh-CN", "en"];

export async function initI18n(locale: Locale = "zh-CN") {
	await i18next.init({
		lng: locale,
		fallbackLng: "zh-CN",
		resources: {
			en: { translation: en },
			"zh-CN": { translation: zhCN },
		},
		interpolation: { escapeValue: false },
	});
}

export const t = i18next.t;

export function detectLocaleFromHeader(acceptLanguage: string): Locale {
	const langs = acceptLanguage
		.split(",")
		.map((s) => (s.trim().split(";")[0] ?? "").toLowerCase());
	for (const lang of langs) {
		const normalized =
			lang === "zh" || lang.startsWith("zh-")
				? "zh-CN"
				: lang.startsWith("en")
					? "en"
					: lang;
		if (SUPPORTED.includes(normalized as Locale)) return normalized as Locale;
	}
	return "zh-CN";
}

export function detectLocaleFromCookie(
	cookie: string | undefined,
): Locale | null {
	if (!cookie) return null;
	const match = cookie.match(/(?:^|;\s*)locale=([^;]+)/);
	if (match?.[1] && SUPPORTED.includes(match[1] as Locale))
		return match[1] as Locale;
	return null;
}

export function getLocaleResources(locale: Locale) {
	const content = locale === "en" ? en : zhCN;
	return { translation: content };
}
