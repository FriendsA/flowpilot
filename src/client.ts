import { meta as config } from "./commands/config/meta";
import { meta as release } from "./commands/release/meta";

type ClientModule = { mount: (el: HTMLElement) => void };

const routes: Record<string, () => Promise<ClientModule>> = {
	[config.href]: () => import("./commands/config/client"),
	[release.href]: () => import("./commands/release/client"),
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
