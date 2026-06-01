# FlowPilot — Jira & GitLab workflow automation CLI

## Project Overview

FlowPilot is a CLI + Web tool that automates Jira/GitLab release workflows. Built with Hono, hono/jsx/dom, clack, i18next, GitBeaker, running on Node 22+ with pnpm.

## Tech Stack

- Runtime: Node 22+ (ESM only)
- Build: rolldown (aggressive tree-shaking — code after `return` in try-catch may be removed)
- Server: Hono (`@hono/node-server`)
- Client: `hono/jsx/dom` (NOT React — custom JSX runtime, no hooks beyond useReducer)
- CLI: `@clack/prompts` + `@inquirer/search`
- i18n: i18next with `{{variable}}` interpolation
- Test: vitest
- Lint: biome
- Clipboard: tinyclip (NOT clipboardy)

## Commit Message Convention

This project uses conventional commits. CI automatically determines version bump from commit messages:

- `feat!` or `BREAKING CHANGE` → **major** (x.0.0)
- `feat:` → **minor** (0.x.0)
- `fix:` / `chore:` / `refactor:` / `docs:` / `test:` → **patch** (0.0.x)

Format: `type(scope): description`

Examples:
- `feat(release): add MR creation flow`
- `fix(end): resolve branch selection bug`
- `chore: update dependencies`
- `feat!: redesign entire CLI interface`
- `docs: rewrite README as user guide [skip ci]`

**IMPORTANT:** Every commit message must follow this format. The CI pipeline (`scripts/bump-version.sh`) parses commit messages since the last tag to determine version bump type.

## Release Flow

- Push to `main` → GitHub Actions auto-publishes via OIDC (no NPM_TOKEN needed)
- `[skip ci]` in commit message → skip release
- Manual: `pnpm release` (auto bump) / `pnpm release:patch` / `pnpm release:minor` / `pnpm release:major`

## Architecture Notes

- `src/commands/*/action.ts` — CLI actions (clack prompts)
- `src/commands/*/routes.tsx` — Hono server routes (API endpoints)
- `src/commands/*/client.tsx` — Web UI (hono/jsx/dom, useReducer pattern)
- `src/store.ts` — Local history persistence (`~/.flowpilot/history/`)
- `src/gitlab-controller.ts` — GitLab API wrapper (GitBeaker, `camelize: true`)
- `src/jira-controller.ts` — Jira API wrapper
- `src/jenkins-controller.ts` — Jenkins API wrapper (crumb auth, build trigger)
- `src/utils/git.ts` — Git CLI helpers (execSync, no simple-git dependency)
- `src/utils/search.ts` — `searchSelect` (always-searchable CLI selection) + `filterByRelevance`
- `src/utils/mr.ts` — MR creation helpers (description generation, project resolution, fallback logic)
- `src/shared/components/` — Shared Web UI components (common, pipeline, select)
- `src/i18n/` — i18next with `cli/` (CLI) and `web/` (Web) namespaces

## Coding Rules

- Never use React patterns — this is `hono/jsx/dom`
- Use `useReducer` for state management, not useState/useEffect
- Store operations after `return` inside try-catch will be tree-shaked — always place Store updates BEFORE final return, outside try-catch blocks
- projectId type mismatch: use `Number(e.projectId) === projectId` for comparisons
- GitBeaker `camelize: true` converts `web_url` → `webUrl` in API responses
- Clipboard: use `tinyclip` (`writeText`), NOT `clipboardy`
- Jenkins config fields: `jenkinsHost`, `jenkinsUser`, `jenkinsPassword` in `~/.flowpilot/config.json`
- CLI branch/project/reviewer/Jira selection: always use `searchSelect` from `src/utils/search.ts` (searchable, no threshold). Small fixed-choice selections (history, Jira transitions) keep `clack.select`
- i18n: CLI uses `t("key")` from `src/i18n/cli.ts`, Web uses `useT()` from `src/i18n/web.ts`
- Code comments language: match existing codebase (auto-detect, currently English)