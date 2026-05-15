import { defineConfig } from "rolldown";
import fs from "node:fs";
import path from "node:path";

const sharedExternals = [
	"node:fs",
	"node:os",
	"node:path",
	"node:url",
	"node:http",
	"node:https",
	"node:child_process",
	"node:crypto",
];

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
		external: sharedExternals,
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
		external: sharedExternals,
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
		external: sharedExternals,
		transform: {
			jsx: { runtime: "automatic", importSource: "hono/jsx" },
		},
	},

	// Client bundle (Browser target, code splitting enabled)
	{
		input: { client: "src/client.ts" },
		output: {
			dir: "dist/client",
			format: "esm",
			entryFileNames: "[name].js",
			chunkFileNames: "chunks/[name]-[hash].js",
		},
		platform: "browser",
		transform: {
			jsx: { runtime: "automatic", importSource: "hono/jsx" },
		},
		plugins: [copyFaviconsPlugin()],
	},
]);