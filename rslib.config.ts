import { defineConfig } from "@rslib/core";

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

export default defineConfig({
	tools: {
		swc: {
			jsc: {
				transform: {
					react: {
						runtime: "automatic",
						importSource: "hono/jsx",
					},
				},
			},
		},
	},
	lib: [
		{
			format: "esm",
			syntax: "esnext",
			source: {
				entry: {
					cli: "./src/cli.ts",
				},
			},
			banner: {
				js: "#!/usr/bin/env node",
			},
			output: {
				target: "node",
				externals: sharedExternals,
				copy: [{ from: "**/*", to: "public/", context: "favicon" }],
			},
		},
		{
			format: "esm",
			syntax: "esnext",
			source: {
				entry: {
					server: "./src/index.ts",
				},
			},
			output: {
				target: "node",
				externals: sharedExternals,
			},
		},
		{
			format: "esm",
			syntax: "esnext",
			source: {
				entry: {
					serve: "./src/serve.ts",
				},
			},
			output: {
				target: "node",
				externals: sharedExternals,
			},
		},
		{
			format: "esm",
			syntax: "esnext",
			source: {
				entry: {
					"client/client": "./src/client.ts",
				},
			},
			output: {
				target: "web",
			},
			tools: {
				rspack: (config) => {
					config.externals = [];
					config.optimization ??= {};
					config.optimization.splitChunks = false;
					config.module.parser ??= {};
					config.module.parser.javascript ??= {};
					config.module.parser.javascript.dynamicImportMode = "eager";
					return config;
				},
			},
		},
	],
});
