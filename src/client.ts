import { meta as config } from "./commands/config/meta";
import { meta as end } from "./commands/end/meta";
import { meta as mr } from "./commands/mr/meta";
import { meta as release } from "./commands/release/meta";
import { meta as watch } from "./commands/watch/meta";

type ClientModule = { mount: (el: HTMLElement) => void };

const routes: Record<string, () => Promise<ClientModule>> = {
	[config.href]: () => import("./commands/config/client"),
	[end.href]: () => import("./commands/end/client"),
	[mr.href]: () => import("./commands/mr/client"),
	[release.href]: () => import("./commands/release/client"),
	[watch.href]: () => import("./commands/watch/client"),
};

async function boot() {
	const el = document.getElementById("app");
	if (!el) return;

	const path = window.location.pathname;
	const loader = routes[path];
	if (!loader) return;

	const mod = await loader();
	mod.mount(el);
}

boot();
