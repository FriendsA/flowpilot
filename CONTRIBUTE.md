<div align="center">

# FlowPilot

**Bridge Jira & GitLab — automate your release workflow**

A CLI + Web Dashboard tool that connects Jira and GitLab to streamline
release issue creation, version management, and project coordination.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.13-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4-E3602B?logoColor=white)](https://hono.dev/)
[![License](https://img.shields.io/badge/License-ISC-gray)](./package.json)

</div>

---

## Why FlowPilot?

Creating a release issue in Jira usually means: open GitLab → find the project → pick a branch → check pom.xml → open Jira → find the right project → create a version → fill in the issue form. **FlowPilot automates all of that** — one command or a few clicks in the dashboard.

## Features

- **Smart project detection** — auto-resolves GitLab project from your `git remote origin`
- **Interactive CLI** — step-by-step prompts with fuzzy search (`@clack/prompts` + `@inquirer/search`)
- **Web Dashboard** — dark-themed UI with sidebar, dropdowns, and keyboard navigation
- **POM version parsing** — fetches `pom.xml` from GitLab and extracts version info
- **Jira integration** — creates release issues, ensures project versions, deduplicates existing issues
- **MR creation** — create Merge Requests with branch selection, auto-push, Jira status update, and pipeline trigger
- **Jenkins integration** — trigger builds and monitor pipeline status
- **i18n** — supports `zh-CN` and `en`, auto-detected from system locale / browser headers
- **Local-only credentials** — all config stored at `~/.flowpilot/config.json`, never sent externally
- **Zero framework overhead** — Hono SSR + `hono/jsx/dom` CSR, no React/Vue dependency

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Configure Jira & GitLab credentials
./dist/cli.js config

# Create a release issue (CLI mode)
./dist/cli.js release

# Or launch the web dashboard
./dist/cli.js serve
# → opens http://127.0.0.1:8787
```

## CLI Reference

| Command | Description | Options |
|---------|-------------|---------|
| `flowpilot config` | Configure credentials (Jira, GitLab, Jenkins) | `-o, --open` Open settings in browser |
| `flowpilot release` | Create release request (auto-extract version and create Jira Issue) | `-o, --open` Open release page in browser |
| `flowpilot end` | Complete current task (auto rebase, push, create MR, update Jira) | `-b <branch>`, `-o, --open` |
| `flowpilot mr` | Create Merge Request (auto-generate title and description) | `-t <branch>`, `--draft`, `-o, --open` |
| `flowpilot watch` | Monitor Jenkins builds (auto-poll every 60 seconds) | `-o, --open` |
| `flowpilot serve` | Start web service | — |
| `flowpilot stop` | Stop web service | — |
| `flowpilot restart` | Restart web service | — |
| `flowpilot update` | Update FlowPilot to latest version | — |

### Release Workflow (CLI)

```mermaid
graph LR
    A[Detect Git Remote] --> B[Resolve GitLab Project]
    B --> C[Select Branch]
    C --> D[Fetch pom.xml]
    D --> E[Extract Version]
    E --> F[Select Jira Project]
    F --> G{Issue Exists?}
    G -->|Yes| H[Return Existing Issue URL]
    G -->|No| I[Ensure Jira Version]
    I --> J[Create Release Issue]
    J --> K[Copy URL to Clipboard]
```

### Release Workflow (Web)

The web dashboard provides the same flow with an interactive UI — select project → branch → view version → pick Jira project → create issue. All operations happen via API calls to the same controllers.

## Project Structure

```
src/
├── cli.ts                 # CLI entry (cac)
├── index.ts               # Library entry, exports public API
├── serve.ts               # Background service bootstrap
├── server.tsx             # Hono server (layout, routes, static assets)
├── client.ts              # Browser entry (dynamic module loading)
├── config.ts              # Local config read/write (~/.flowpilot/config.json)
├── constants.ts           # Constants (port, host, version)
├── types.ts               # Shared type definitions
├── jira-controller.ts     # Jira API wrapper
├── gitlab-controller.ts   # GitLab API wrapper (@gitbeaker/rest)
├── jenkins-controller.ts  # Jenkins API wrapper (crumb auth, build trigger)
├── commands/
│   ├── index.ts           # Aggregated action exports
│   ├── config/            # Settings command
│   ├── release/           # Release command
│   ├── end/               # End task command
│   └── mr/                # Merge Request command
├── shared/
│   ├── layout.tsx         # Global Layout (sidebar + topbar)
│   ├── menus.ts           # Sidebar menu registry
│   ├── style.ts           # CSS variables & base styles
│   └── components/        # Shared Web UI components
│       ├── common.tsx     # Spinner, result card, action/copy buttons
│       ├── pipeline.tsx   # Pipeline step indicators
│       └── select.tsx     # Searchable dropdown with keyboard nav
├── i18n/
│   ├── cli.ts             # CLI i18n (system locale detection)
│   ├── web.ts             # Web i18n (cookie/header detection)
│   └── locales/
│       ├── zh-CN.json     # Chinese translations
│       └── en.json        # English translations
└── utils/
    ├── config.ts           # Config validation helpers
    ├── git.ts              # Git remote detection & parsing
    ├── mr.ts               # MR creation helpers (description, project resolution, fallback)
    ├── pom.ts              # POM XML parser
    └── search.ts           # Fuzzy relevance filter
```

## Command Convention

Each command is a self-contained folder with four required files:

| File | Required | Purpose |
|------|----------|---------|
| `meta.ts` | Yes | Sidebar menu metadata (title, icon, href, category) |
| `routes.tsx` | Yes | Hono routes: page mount point + API endpoints |
| `client.tsx` | Yes | Browser-side component (`hono/jsx/dom`), exports `mount(el)` |
| `action.ts` | Yes | CLI command entry (handles `--open` and other flags) |

```
commands/<name>/
├── meta.ts        # Menu metadata
├── routes.tsx     # Routes + API
├── client.tsx     # Client component
└── action.ts      # CLI entry
```

All pages use client-side rendering: `routes.tsx` renders a mount point (`<div id="app">`), `client.tsx` loads data in the browser and takes over rendering.

## Adding a New Command

### 1. Create meta.ts

```ts
// src/commands/<name>/meta.ts
export const meta = {
  titleKey: "web.<name>Title",
  icon: "&#128260;",
  href: "/<name>",
  categoryKey: "web.generalCategory",
} as const;
```

Add the corresponding i18n key to `src/i18n/locales/zh-CN.json` and `en.json`.

### 2. Create routes.tsx

```tsx
// src/commands/<name>/routes.tsx
import { Hono } from "hono";

const router = new Hono();

router.get("/", (c) =>
  c.render(<div id="app">Loading...</div>, { title: "Page Title" }),
);

router.get("/api/data", async (c) => {
  return c.json({ ok: true });
});

export const <name>Routes = router;
```

### 3. Create client.tsx

```tsx
// src/commands/<name>/client.tsx
import { type FC, useEffect, useState } from "hono/jsx";
import { render } from "hono/jsx/dom";

const MyClient: FC = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/<name>/api/data")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return <div>{/* page content */}</div>;
};

export function mount(el: HTMLElement) {
  render(<MyClient />, el);
}
```

### 4. Create action.ts

```ts
// src/commands/<name>/action.ts
import { openPage } from "../../server";

export const <name>Action = async (options: {
  open?: boolean;
  o?: boolean;
  "--": unknown[];
}) => {
  if (options.open) {
    openPage("/<name>");
    return;
  }
  // CLI logic...
};
```

### 5. Register in entry files

| File | What to add |
|------|-------------|
| `src/server.tsx` | `app.route("/<name>", <name>Routes)` |
| `src/shared/menus.ts` | Add `meta` import to `menus` array |
| `src/client.ts` | Add route mapping in `routes` object |
| `src/commands/index.ts` | Export `<name>Action` |
| `src/cli.ts` | Add `cli.command("<name>", ...).action(<name>Action)` |

### Checklist

- [ ] `src/commands/<name>/meta.ts` — menu metadata
- [ ] `src/commands/<name>/routes.tsx` — routes + API
- [ ] `src/commands/<name>/client.tsx` — client component
- [ ] `src/commands/<name>/action.ts` — CLI entry
- [ ] `src/server.tsx` — register route
- [ ] `src/shared/menus.ts` — register menu
- [ ] `src/client.ts` — register client module
- [ ] `src/commands/index.ts` — register action
- [ ] `src/cli.ts` — register CLI command
- [ ] `src/i18n/locales/zh-CN.json` + `en.json` — add i18n keys

## Tech Stack

| Category | Tool | Version |
|----------|------|---------|
| Runtime | Node.js | >= 22.13 |
| Package Manager | pnpm | 11 |
| Language | TypeScript | 6 |
| Build | rolldown | — |
| Server | Hono | 4 |
| Client Render | hono/jsx/dom | — |
| CLI Framework | cac | 7 |
| Interactive CLI | @clack/prompts | 1.4 |
| Fuzzy Search | @inquirer/search | 4 |
| GitLab SDK | @gitbeaker/rest | 43 |
| i18n | i18next | 26 |
| Colors | picocolors | 1 |
| Clipboard | tinyclip | — |
| Lint | Biome | 2 |
| Test | Vitest | 4 |

## Build Architecture

Rslib produces four bundles:

| Bundle | Entry | Target | Purpose |
|--------|-------|--------|---------|
| `cli.js` | `src/cli.ts` | Node | CLI binary (`#!/usr/bin/env node`) |
| `server.js` | `src/index.ts` | Node | Library export (server utilities + controllers) |
| `serve.js` | `src/serve.ts` | Node | Background daemon (starts Hono server) |
| `client/client.js` | `src/client.ts` | Web | Browser-side module loader |

Client bundle uses `dynamicImportMode: "eager"` and no chunk splitting — all command client modules are bundled into one file for simplicity.

## Development

```bash
# Install
pnpm install

# Dev mode (watch)
pnpm dev

# Lint & format
pnpm check

# Run tests
pnpm test

# Build for production
pnpm build
```

## Configuration

Credentials are stored locally at `~/.flowpilot/config.json`:

```json
{
  "jiraHost": "https://jira.example.com",
  "jiraName": "username",
  "jiraPassword": "password",
  "gitlabHost": "http://git.example.com",
  "gitlabKey": "glpat-xxxxxxxxxxxxxxxxxxxx",
  "jenkinsHost": "https://jenkins.example.com",
  "jenkinsUser": "username",
  "jenkinsPassword": "api-token"
}
```

- `jiraHost` — Jira server URL (with protocol prefix)
- `jiraName` — Jira account name (without @ suffix)
- `jiraPassword` — Jira password (stored locally only)
- `gitlabHost` — GitLab server URL (with protocol prefix)
- `gitlabKey` — GitLab Personal Access Token
- `jenkinsHost` — Jenkins server URL (with protocol prefix)
- `jenkinsUser` — Jenkins username
- `jenkinsPassword` — Jenkins password or API token (stored locally only)

## pom.xml Custom Fields

FlowPilot reads custom fields from `pom.xml` to extract metadata for release management and Jenkins integration.

**Supported fields (in priority order):**

1. `<flowpilot><releaseName>` — human-readable name for releases (Jira version/issues)
2. `<flowpilot><jenkinsJob>` — Jenkins job name for pipeline monitoring
3. `<properties><flowPilotName>` — legacy fallback for `releaseName`
4. `<properties><jenkinsJobName>` — legacy fallback for `jenkinsJob`

**Example:**

```xml
<project>
  <version>1.2.3-SNAPSHOT</version>
  
  <flowpilot>
    <releaseName>my-service</releaseName>
    <jenkinsJob>my-service-deploy</jenkinsJob>
  </flowpilot>
</project>
```

**Standard fields also used:**
- `<version>` — project version (auto-strips `-SNAPSHOT`, `-beta`, etc.)
- `<groupId>` — Maven group ID

For complete documentation, see [docs/pom-configuration.md](docs/pom-configuration.md).

## License

ISC