import type { Child, FC } from "hono/jsx";
import { VERSION } from "../constants";
import type { Locale } from "../i18n/web";
import { t } from "../i18n/web";
import { menus } from "./menus";
import { globalStyle } from "./style";

const BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;

const SETTINGS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;

const CHEVRON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;

type LayoutProps = {
	activeHref: string;
	pageTitle?: string | undefined;
	locale: Locale;
	localeResources: Record<string, unknown>;
	children: Child;
};

export const Layout: FC<LayoutProps> = ({
	activeHref,
	locale,
	localeResources,
	children,
}) => {
	const isConfig = activeHref.startsWith("/config");

	const scriptContent = `
		(function() {
			var sidebar = document.querySelector('.sidebar');
			var toggle = document.querySelector('.sidebar-toggle');
			if (!sidebar || !toggle) return;

			var saved = localStorage.getItem('flowpilot-sidebar_collapsed');
			if (saved === 'true') {
				sidebar.classList.add('collapsed');
			}

			toggle.addEventListener('click', function() {
				sidebar.classList.toggle('collapsed');
				localStorage.setItem('flowpilot_sidebar_collapsed', sidebar.classList.contains('collapsed'));
			});
		})();
	`;

	return (
		<html lang={locale}>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>FlowPilot</title>
				<link rel="icon" type="image/x-icon" href="/public/favicon.ico" />
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href="/public/favicon-32x32.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="16x16"
					href="/public/favicon-16x16.png"
				/>
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href="/public/apple-touch-icon.png"
				/>
				<link rel="manifest" href="/public/site.webmanifest" />
				<style>{globalStyle}</style>
				<script type="module" src={`/client/client.js?v=${Date.now()}`} defer />
				<script
					dangerouslySetInnerHTML={{
						__html: `window.__I18N_LOCALE__='${locale}';window.__I18N_RESOURCES__=${JSON.stringify({ [locale]: localeResources })}`,
					}}
				/>
			</head>
			<body>
				<a href="#main-content" class="skip-link">
					{t("web.skipToContent") ?? "Skip to content"}
				</a>

				<aside class="sidebar" role="navigation" aria-label="Main navigation">
					<div class="sidebar-header">
						<div class="sidebar-brand">
							<div
								class="brand-icon"
								dangerouslySetInnerHTML={{ __html: BRAND_SVG }}
							/>
							<div class="brand-text">
								<span class="brand-name">FlowPilot</span>
								<span class="brand-version">v{VERSION}</span>
							</div>
						</div>
						<button
							class="sidebar-toggle"
							type="button"
							aria-label="Toggle sidebar"
							dangerouslySetInnerHTML={{ __html: CHEVRON_SVG }}
						/>
					</div>

					<nav class="sidebar-nav">
						{menus.map((m) => {
							const isCurrent = m.href === activeHref;
							return (
								<a
									href={m.href}
									class={`nav-item${isCurrent ? " active" : ""}`}
									{...(isCurrent ? { "aria-current": "page" as any } : {})}
								>
									<span
										class="nav-item-icon"
										dangerouslySetInnerHTML={{ __html: m.icon }}
									/>
									<span class="nav-item-label">{t(m.titleKey)}</span>
								</a>
							);
						})}
					</nav>

					<div class="sidebar-footer">
						<a
							class={`footer-settings${isConfig ? " active" : ""}`}
							href="/config"
							aria-label={t("web.settingsAria")}
						>
							<span
								class="footer-settings-icon"
								dangerouslySetInnerHTML={{ __html: SETTINGS_SVG }}
							/>
							<span class="footer-settings-label">
								{t("web.settingsTitle")}
							</span>
						</a>
					</div>
				</aside>

				<div class="main-wrapper">
					<main class="main" id="main-content">
						<div class="content" tabindex="-1">
							{children}
						</div>
					</main>
				</div>

				<script dangerouslySetInnerHTML={{ __html: scriptContent }} />
			</body>
		</html>
	);
};
