// Shared i18n initialization for all Web UI client modules
import i18next from "i18next";

declare global {
	interface Window {
		__I18N_LOCALE__: string;
		__I18N_RESOURCES__: Record<
			string,
			{ translation: Record<string, unknown> }
		>;
	}
}

export const initPromise =
	typeof window !== "undefined" &&
	window.__I18N_LOCALE__ &&
	window.__I18N_RESOURCES__
		? i18next.init({
				lng: window.__I18N_LOCALE__,
				fallbackLng: "zh-CN",
				resources: window.__I18N_RESOURCES__,
				interpolation: { escapeValue: false },
			})
		: Promise.resolve();

export const t = i18next.t;
