import type { Child, FC } from "hono/jsx";
import { VERSION } from "../constants";
import { menus } from "./menus";
import { globalStyle } from "./style";

type LayoutProps = {
	activeHref: string;
	pageTitle?: string | undefined;
	children: Child;
};

export const Layout: FC<LayoutProps> = ({
	activeHref,
	pageTitle,
	children,
}) => {
	const grouped = menus.reduce<Record<string, typeof menus>>((acc, m) => {
		const list = acc[m.category];
		if (list) {
			list.push(m);
		} else {
			acc[m.category] = [m];
		}
		return acc;
	}, {});

	return (
		<html lang="zh-CN">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>FlowPilot{pageTitle ? ` - ${pageTitle}` : ""}</title>
				<style>{globalStyle}</style>
				<script type="module" src="/client/client.js" defer />
			</head>
			<body>
				<nav class="sidebar">
					<div class="sidebar-brand">
						<div class="sidebar-brand-icon">&#9881;</div>
						<div class="sidebar-brand-text">FlowPilot</div>
					</div>

					{Object.entries(grouped).map(([category, items]) => (
						<div>
							<div class="sidebar-label">{category}</div>
							{items.map((item) => (
								<a
									href={item.href}
									class={`sidebar-item${item.href === activeHref ? " active" : ""}`}
								>
									<span
										class="sidebar-item-icon"
										dangerouslySetInnerHTML={{ __html: item.icon }}
									/>
									{item.title}
								</a>
							))}
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
						</div>
					)}
					<div class="content">{children}</div>
				</div>
			</body>
		</html>
	);
};
