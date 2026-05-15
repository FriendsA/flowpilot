import { defineConfig } from "rolldown";

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

export default defineConfig([
	// CLI binary (Node target, shebang header)
	{
		input: { cli: "src/cli.ts" },
		output: {
			dir: "dist",
			format: "esm",
			entryFileNames: "[name].js",
			banner: { js: "#!/usr/bin/env node" },
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
	},
]);