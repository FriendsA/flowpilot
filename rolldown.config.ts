import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "rolldown";

// Match all Node.js built-in modules (node:* prefix + bare names like 'tty', 'stream')
const nodeBuiltins =
	/^node:|^(tty|stream|util|async_hooks|readline|process|fs|os|path|url|http|https|child_process|crypto|buffer|events|net|dns|timers|zlib|string_decoder|vm|assert|inspector|perf_hooks|worker_threads|dgram|console|constants|domain|module|punycode|querystring|tls|v8|wasi)$/;

// Node-target builds: externalize node built-ins, suppress resolve warnings
// (node:* modules are available at runtime — UNRESOLVED_IMPORT is noise)
// NOTE: checks.unresolvedImport=false doesn't suppress warnings in rolldown v1.0.1
// (bug: Rust resolver prints UNRESOLVED_IMPORT before JS onLog/checks can intercept).
// Keep the config for forward-compat — will work once rolldown fixes the bug.
const nodeBuildConfig = {
	external: [nodeBuiltins],
	checks: { unresolvedImport: false },
};

// Plugin to copy favicon assets after each build
function copyFaviconsPlugin() {
	return {
		name: "copy-favicons",
		writeBundle() {
			const srcDir = path.resolve("favicon");
			const destDir = path.resolve("dist/public");
			if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
			for (const file of fs.readdirSync(srcDir)) {
				fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
			}
			console.log("✓ Copied favicon assets → dist/public/");
		},
	};
}

export default defineConfig([
	// CLI binary (Node target, shebang header)
	{
		input: { cli: "src/cli.ts" },
		output: {
			dir: "dist",
			format: "esm",
			entryFileNames: "[name].js",
			banner: "#!/usr/bin/env node",
		},
		platform: "node",
		...nodeBuildConfig,
		transform: {
			jsx: { runtime: "automatic", importSource: "hono/jsx" },
		},
	},

	// Server library export (Node target)
	{
		input: { server: "src/index.ts" },
		output: {
			dir: "dist",
			format: "esm",
			entryFileNames: "[name].js",
		},
		platform: "node",
		...nodeBuildConfig,
		transform: {
			jsx: { runtime: "automatic", importSource: "hono/jsx" },
		},
	},

	// Serve daemon (Node target)
	{
		input: { serve: "src/serve.ts" },
		output: {
			dir: "dist",
			format: "esm",
			entryFileNames: "[name].js",
		},
		platform: "node",
		...nodeBuildConfig,
		transform: {
			jsx: { runtime: "automatic", importSource: "hono/jsx" },
		},
	},

	// Client bundle (Browser target, code splitting enabled)
	{
		input: { client: "src/client.tsx" },
		output: {
			dir: "dist/client",
			format: "esm",
			entryFileNames: "[name].js",
			chunkFileNames: "chunks/[name]-[hash].js",
		},
		platform: "browser",
		external: [nodeBuiltins],
		transform: {
			jsx: { runtime: "automatic", importSource: "hono/jsx" },
		},
		plugins: [copyFaviconsPlugin()],
	},
]);
