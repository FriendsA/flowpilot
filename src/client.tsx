import { render } from "hono/jsx/dom";
import { meta as config } from "./commands/config/meta";
import { meta as end } from "./commands/end/meta";
import { meta as mr } from "./commands/mr/meta";
import { meta as release } from "./commands/release/meta";
import { meta as watch } from "./commands/watch/meta";
import { Crosshair } from "./shared/components/neonblade/crosshair";
import { DatalinesWithGrid } from "./shared/components/neonblade/datalines-with-grid";
import { initPromise } from "./shared/i18n";

type ClientModule = { mount: (el: HTMLElement) => void };

const routes: Record<string, () => Promise<ClientModule>> = {
	[config.href]: () => import("./commands/config/client"),
	[end.href]: () => import("./commands/end/client"),
	[mr.href]: () => import("./commands/mr/client"),
	[release.href]: () => import("./commands/release/client"),
	[watch.href]: () => import("./commands/watch/client"),
};

declare global {
	var __FLOWPILOT_BOOTED__: boolean | undefined;
}

async function boot() {
	if (globalThis.__FLOWPILOT_BOOTED__) return;
	globalThis.__FLOWPILOT_BOOTED__ = true;

	await initPromise;
	const bgEl = document.getElementById("datalines-bg");
	if (bgEl) {
		render(
			<DatalinesWithGrid
				lineColor="#00f3ff"
				shadowColor="#00f3ff"
				bgGridColor="rgba(0,243,255,0.04)"
				cellSize={50}
				maxLines={8}
				baseSpeed={2}
				lineLength={120}
				spawnProbability={0.08}
			/>,
			bgEl,
		);
	}

	const cursorHost = document.createElement("div");
	document.body.appendChild(cursorHost);
	render(
		<Crosshair
			color="#ffaa00"
			outerSize={20}
			innerSize={12}
			outerThickness={1.5}
			innerThickness={1}
			crosshairSize={4}
			crosshairGap={2}
			crosshairThickness={0.8}
			glowIntensity="low"
		/>,
		cursorHost,
	);

	const el = document.getElementById("app");
	if (!el) return;

	const path = window.location.pathname;
	const loader = routes[path];
	if (!loader) return;

	const mod = await loader();
	mod.mount(el);
}

boot();
