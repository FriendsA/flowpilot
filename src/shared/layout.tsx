import type { Child, FC } from "hono/jsx";
import { VERSION } from "../constants";
import { t } from "../i18n/web";
import type { Locale } from "../i18n/web";
import { menus } from "./menus";
import { globalStyle } from "./style";

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
				<nav class="sidebar">
					<div class="sidebar-brand">
						<div class="sidebar-brand-icon">&#9881;</div>
						<div class="sidebar-brand-text">FlowPilot</div>
					</div>

					{Object.entries(grouped).map(([category, titleKeys]) => (
						<div>
							<div class="sidebar-label">{category}</div>
							{titleKeys.map((titleKey) => {
								const item = menus.find((m) => m.titleKey === titleKey);
								return (
									<a
										href={item!.href}
										class={`sidebar-item${item!.href === activeHref ? " active" : ""}`}
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

				<div class="main">
					{pageTitle && (
						<div class="topbar">
							<span class="topbar-title">
								<strong>{pageTitle}</strong>
							</span>
							<a class="topbar-settings" href="/config" aria-label={t("web.settingsAria")}>&#9881;</a>
						</div>
					)}
					<div class="content">{children}</div>
				</div>
			</body>
		</html>
	);
};