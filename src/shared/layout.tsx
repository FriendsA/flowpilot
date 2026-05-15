import type { Child, FC } from "hono/jsx";
import { VERSION } from "../constants";
import { t } from "../i18n/web";
import type { Locale } from "../i18n/web";
import { menus } from "./menus";
import { globalStyle } from "./style";

const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;

type LayoutProps = {
	activeHref: string;
	pageTitle?: string | undefined;
	locale: Locale;
	localeResources: Record<string, unknown>;
	children: Child;
};

export const Layout: FC<LayoutProps> = ({
	activeHref,
	pageTitle,
	locale,
	localeResources,
	children,
}) => {
	const grouped = menus.reduce<Record<string, string[]>>((acc, m) => {
		const category = t(m.categoryKey);
		const list = acc[category];
		if (list) {
			list.push(m.titleKey);
		} else {
			acc[category] = [m.titleKey];
		}
		return acc;
	}, {});

	return (
		<html lang={locale}>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>FlowPilot{pageTitle ? ` - ${pageTitle}` : ""}</title>
				<link rel="icon" type="image/x-icon" href="/public/favicon.ico" />
				<link rel="icon" type="image/png" sizes="32x32" href="/public/favicon-32x32.png" />
				<link rel="icon" type="image/png" sizes="16x16" href="/public/favicon-16x16.png" />
				<link rel="apple-touch-icon" sizes="180x180" href="/public/apple-touch-icon.png" />
				<link rel="manifest" href="/public/site.webmanifest" />
								<style>{globalStyle}</style>
				<script type="module" src="/client/client.js" defer />
				<script dangerouslySetInnerHTML={{ __html: `window.__I18N_LOCALE__='${locale}';window.__I18N_RESOURCES__=${JSON.stringify({ [locale]: localeResources })}` }} />
			</head>
			<body>
				<a href="#main-content" class="skip-link">{t("web.skipToContent") ?? "Skip to content"}</a>

				<nav class="sidebar" aria-label="Main navigation">
					<div class="sidebar-brand">
						<div class="sidebar-brand-icon" dangerouslySetInnerHTML={{ __html: GEAR_SVG }} />
						<div class="sidebar-brand-text">FlowPilot</div>
					</div>

					{Object.entries(grouped).map(([category, titleKeys]) => (
						<div>
							<div class="sidebar-label">{category}</div>
							{titleKeys.map((titleKey) => {
								const item = menus.find((m) => m.titleKey === titleKey);
								const isCurrent = item!.href === activeHref;
								return (
									<a
										href={item!.href}
										class={`sidebar-item${isCurrent ? " active" : ""}`}
										{...(isCurrent ? { "aria-current": "page" as any } : {})}
									>
										<span
											class="sidebar-item-icon"
											dangerouslySetInnerHTML={{ __html: item!.icon }}
										/>
										{t(titleKey)}
									</a>
								);
							})}
						</div>
					))}

					<div class="sidebar-footer">v{VERSION}</div>
				</nav>

				<div class="main" id="main-content" role="main">
					{pageTitle && (
						<div class="topbar">
							<span class="topbar-title">
								<strong>{pageTitle}</strong>
							</span>
							<a class="topbar-settings" href="/config" aria-label={t("web.settingsAria")} dangerouslySetInnerHTML={{ __html: GEAR_SVG }} />
						</div>
					)}
					<div class="content" tabindex="-1">{children}</div>
				</div>
			</body>
		</html>
	);
};