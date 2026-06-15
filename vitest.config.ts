import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"react/jsx-dev-runtime": "hono/jsx/jsx-dev-runtime",
			"react/jsx-runtime": "hono/jsx/jsx-runtime",
			react: "hono/jsx",
		},
	},
	test: {
		exclude: [".claude/worktrees/**"],
	},
});
