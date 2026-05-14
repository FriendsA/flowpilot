import { exec, spawn } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { configRoutes } from "./commands/config/routes";
import { releaseRoutes } from "./commands/release/routes";
import { PID_FILE, PORT, SERVER_URL } from "./constants";
import { Layout } from "./shared/layout";

declare module "hono" {
	interface ContextRenderer {
		(
			content: string | Promise<string>,
			head: { title?: string },
		): Response | Promise<Response>;
	}
}

const app = new Hono();

// Global renderer — wraps every page in the shared layout
app.use("/*", async (c, next) => {
	c.setRenderer((content, head) =>
		c.html(
			<Layout activeHref={c.req.path} pageTitle={head?.title}>
				{content}
			</Layout>,
		),
	);
	await next();
});

app.route("/config", configRoutes);
app.route("/release", releaseRoutes);

// Serve client-side bundles and shared chunks (all under /client/)
const __serverDir = dirname(fileURLToPath(import.meta.url));

app.get("/client/*", async (c) => {
	const filePath = join(__serverDir, c.req.path);
	try {
		const content = fs.readFileSync(filePath);
		return new Response(content, {
			headers: { "Content-Type": "application/javascript" },
		});
	} catch {
		return c.notFound();
	}
});

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

export const startServerInBackground = async () => {
	if (await isPortInUse(PORT)) return;

	const __dirname = dirname(fileURLToPath(import.meta.url));
	const serverPath = join(__dirname, "serve.js");

	const child = spawn("node", [serverPath], {
		detached: true,
		stdio: "ignore",
	});

	if (child.pid) {
		fs.writeFileSync(PID_FILE, String(child.pid));
	}

	child.unref();
};

export const stopServer = (): boolean => {
	if (!fs.existsSync(PID_FILE)) {
		return false;
	}

	const pid = Number(fs.readFileSync(PID_FILE, "utf-8").trim());

	try {
		process.kill(pid, "SIGTERM");
	} catch {
		// process already dead
	}

	try {
		fs.unlinkSync(PID_FILE);
	} catch {
		// file already removed
	}

	return true;
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
	exec(`${cmd} ${url}`);
};

export const openPage = async (path: string) => {
	await startServerInBackground();
	openBrowser(`${SERVER_URL}${path}`);
};
