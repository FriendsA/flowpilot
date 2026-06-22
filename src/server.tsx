import { execFile, execSync, spawn } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { configRoutes } from "./commands/config/routes";
import { endRoutes } from "./commands/end/routes";
import { mrRoutes } from "./commands/mr/routes";
import { releaseRoutes } from "./commands/release/routes";
import { watchRoutes } from "./commands/watch/routes";
import {
	DATA_DIR,
	OLD_PID_FILE,
	PID_FILE,
	PORT,
	SERVER_URL,
} from "./constants";
import {
	detectLocaleFromConfig,
	detectLocaleFromCookie,
	detectLocaleFromHeader,
	getLocaleResources,
	initI18n,
	type Locale,
} from "./i18n/web";
import { Layout } from "./shared/layout";

declare module "hono" {
	interface ContextRenderer {
		(
			content: string | Promise<string>,
			head: { title?: string; locale?: Locale },
		): Response | Promise<Response>;
	}
	interface ContextVariableMap {
		locale: Locale;
	}
}

const app = new Hono();

app.use("/*", cors());

// i18n middleware: detect locale, init i18next, inject into renderer
app.use("/*", async (c, next) => {
	const cookieLocale = detectLocaleFromCookie(c.req.header("cookie"));
	const headerLocale = detectLocaleFromHeader(
		c.req.header("accept-language") ?? "",
	);
	const configLocale = detectLocaleFromConfig();
	const locale = configLocale ?? cookieLocale ?? headerLocale;

	await initI18n(locale);

	c.set("locale", locale);

	c.setRenderer((content, head) =>
		c.html(
			<Layout
				activeHref={c.req.path}
				pageTitle={head?.title}
				locale={locale}
				localeResources={getLocaleResources(locale)}
			>
				{content}
			</Layout>,
		),
	);
	await next();
});

app.route("/config", configRoutes);
app.route("/end", endRoutes);
app.route("/mr", mrRoutes);
app.route("/release", releaseRoutes);
app.route("/watch", watchRoutes);

// Serve client-side bundles and shared chunks (all under /client/)
const __serverDir = dirname(fileURLToPath(import.meta.url));
const __clientDir = join(__serverDir, "client");

app.get("/client/*", async (c) => {
	const relative = c.req.path.replace(/^\/client\//, "");
	const filePath = join(__clientDir, relative);
	if (!filePath.startsWith(__clientDir)) return c.notFound();
	try {
		const content = fs.readFileSync(filePath);
		return new Response(content, {
			headers: {
				"Content-Type": "application/javascript",
				"Cache-Control": "no-store",
			},
		});
	} catch {
		return c.notFound();
	}
});

// Serve favicon and other static assets (all under /public/)
const MIME_TYPES: Record<string, string> = {
	".ico": "image/x-icon",
	".png": "image/png",
	".json": "application/json",
	".webmanifest": "application/manifest+json",
};

app.get("/public/*", async (c) => {
	const filePath = join(__serverDir, c.req.path);
	if (!filePath.startsWith(__serverDir)) return c.notFound();
	try {
		const content = fs.readFileSync(filePath);
		const ext = filePath.slice(filePath.lastIndexOf("."));
		return new Response(content, {
			headers: {
				"Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
			},
		});
	} catch {
		return c.notFound();
	}
});

// Redirect /favicon.ico → /public/favicon.ico (browser default lookup path)
app.get("/favicon.ico", (c) => c.redirect("/public/favicon.ico"));

export const startServer = () => {
	return serve({
		fetch: app.fetch,
		port: PORT,
	});
};

export const isPortInUse = (port: number): Promise<boolean> => {
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(true));
		server.once("listening", () => {
			server.close();
			resolve(false);
		});
		server.listen(port);
	});
};

function migrateOldPid() {
	if (fs.existsSync(PID_FILE)) return;
	if (!fs.existsSync(OLD_PID_FILE)) return;
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	try {
		const oldPid = Number(fs.readFileSync(OLD_PID_FILE, "utf-8").trim());
		fs.writeFileSync(PID_FILE, JSON.stringify({ pid: oldPid }));
		fs.renameSync(OLD_PID_FILE, `${OLD_PID_FILE}.bak`);
	} catch {
		// migration failed — proceed without old pid
	}
}

export const startServerInBackground = async () => {
	migrateOldPid();

	if (await isPortInUse(PORT)) return;

	const __dirname = dirname(fileURLToPath(import.meta.url));
	const serverPath = join(__dirname, "serve.js");

	const child = spawn("node", [serverPath], {
		detached: true,
		stdio: "ignore",
	});

	if (child.pid) {
		if (!fs.existsSync(DATA_DIR)) {
			fs.mkdirSync(DATA_DIR, { recursive: true });
		}
		fs.writeFileSync(PID_FILE, JSON.stringify({ pid: child.pid }));
	}

	child.unref();
};

export const stopServer = (): boolean => {
	migrateOldPid();

	let stopped = false;

	// Try PID file first
	const pidSource = fs.existsSync(PID_FILE)
		? PID_FILE
		: fs.existsSync(OLD_PID_FILE)
			? OLD_PID_FILE
			: null;
	if (pidSource) {
		try {
			const raw = fs.readFileSync(pidSource, "utf-8");
			let pid: number;
			if (pidSource === PID_FILE) {
				const parsed = JSON.parse(raw);
				pid = parsed.pid ?? Number(raw.trim());
			} else {
				pid = Number(raw.trim());
			}
			process.kill(pid, "SIGTERM");
			stopped = true;
		} catch {
			// process already dead or file corrupt
		}

		try {
			fs.unlinkSync(PID_FILE);
		} catch {
			// file already removed
		}

		try {
			fs.renameSync(OLD_PID_FILE, `${OLD_PID_FILE}.bak`);
		} catch {
			/* ok */
		}
	}

	// Fallback: find process by port if PID file missing or kill failed
	if (!stopped) {
		try {
			const pidStr = execSync(`lsof -ti :${PORT}`, {
				encoding: "utf-8",
			}).trim();
			if (pidStr) {
				const pid = Number(pidStr);
				if (pid > 0) {
					process.kill(pid, "SIGTERM");
					stopped = true;
				}
			}
		} catch {
			// no process on port or lsof not available
		}
	}

	return stopped;
};

export const restartServerInBackground = async () => {
	stopServer();
	await new Promise((r) => setTimeout(r, 300));
	await startServerInBackground();
};

export const openBrowser = (url: string) => {
	const cmd =
		process.platform === "darwin"
			? "open"
			: process.platform === "win32"
				? "start"
				: "xdg-open";
	execFile(cmd, [url]);
};

export const openPage = async (path: string) => {
	await startServerInBackground();
	openBrowser(`${SERVER_URL}${path}`);
};
