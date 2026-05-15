import { rolldown } from "rolldown";
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

const jsxConfig = {
	jsx: { runtime: "automatic", importSource: "hono/jsx" },
};

const configs = [
	// CLI binary
	{
		input: { cli: "src/cli.ts" },
		output: { dir: "dist", format: "esm", entryFileNames: "[name].js" },
		platform: "node",
		external: sharedExternals,
		transform: jsxConfig,
		banner: { js: "#!/usr/bin/env node" },
	},
	// Server library
	{
		input: { server: "src/index.ts" },
		output: { dir: "dist", format: "esm", entryFileNames: "[name].js" },
		platform: "node",
		external: sharedExternals,
		transform: jsxConfig,
	},
	// Serve daemon
	{
		input: { serve: "src/serve.ts" },
		output: { dir: "dist", format: "esm", entryFileNames: "[name].js" },
		platform: "node",
		external: sharedExternals,
		transform: jsxConfig,
	},
	// Client bundle (browser target, code splitting enabled)
	{
		input: { client: "src/client.ts" },
		output: {
			dir: "dist/client",
			format: "esm",
			entryFileNames: "[name].js",
			chunkFileNames: "chunks/[name]-[hash].js",
		},
		platform: "browser",
		transform: jsxConfig,
	},
];

// Copy favicon assets
function copyFavicons() {
	const srcDir = path.resolve("favicon");
	const destDir = path.resolve("dist/public");
	if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
	for (const file of fs.readdirSync(srcDir)) {
		fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
	}
}

async function build() {
	for (const cfg of configs) {
		const bundle = await rolldown(cfg);
		await bundle.write(cfg.output);
		await bundle.close();
		console.log(`✓ Built: ${Object.keys(cfg.input).join(", ")} → ${cfg.output.dir}`);
	}
	copyFavicons();
	console.log("✓ Copied favicon assets → dist/public/");
}

build().catch((e) => {
	console.error(e);
	process.exit(1);
});