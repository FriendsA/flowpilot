# workflow

## TODO

1. 美化控制台输出

## 项目结构

```
src/
├── cli.ts                 # CLI 入口（cac）
├── index.ts               # 库入口，导出公共 API
├── serve.ts               # 后台服务启动入口
├── server.tsx             # Hono 服务端（全局 layout、路由挂载、静态资源）
├── client.ts              # 浏览器端入口（动态加载各命令的 client 模块）
├── config.ts              # 本地配置读写（~/.workflowrc）
├── constants.ts           # 常量（端口、主机地址等）
├── types.ts               # 公共类型定义
├── jira-controller.ts     # Jira API 封装
├── gitlab-controller.ts   # GitLab API 封装
├── commands/
│   ├── index.ts           # 聚合导出所有 action（供 cli.ts 使用）
│   ├── config/            # Settings 命令
│   └── release/           # Release 命令
└── shared/
    ├── layout.tsx          # 全局 Layout 组件（侧边栏 + 顶栏）
    ├── menus.ts            # 侧边栏菜单注册表
    └── style.ts            # 全局 CSS 变量与基础样式
```

## 命令文件夹约定

每个命令是一个独立文件夹，包含以下文件：

| 文件 | 必须 | 说明 |
|------|------|------|
| `meta.ts` | 是 | 侧边栏菜单元数据（title、icon、href、category） |
| `routes.tsx` | 是 | Hono 路由：页面挂载点（`<div id="app">`）+ API 接口 |
| `client.tsx` | 是 | 浏览器端交互组件（`hono/jsx/dom`），导出 `mount(el)` |
| `action.ts` | 是 | CLI 命令入口（处理 `--open` 等参数） |

所有页面统一使用客户端渲染：`routes.tsx` 渲染挂载点，`client.tsx` 在浏览器端加载数据并接管渲染。

```
commands/<name>/
├── meta.ts        # 菜单元数据
├── routes.tsx     # 路由 + API
├── client.tsx     # 客户端组件
└── action.ts      # CLI 入口
```

## 新建命令步骤

### 1. 创建 meta.ts

```ts
// src/commands/<name>/meta.ts
export const meta = {
	title: "显示名称",
	icon: "&#128260;",      // HTML 实体
	href: "/<name>",        // 路由路径
	category: "分类名",      // 侧边栏分组
} as const;
```

### 2. 创建 routes.tsx

```tsx
// src/commands/<name>/routes.tsx
import { Hono } from "hono";

const router = new Hono();

// 页面挂载点
router.get("/", (c) =>
	c.render(<div id="app">Loading...</div>, { title: "页面标题" }),
);

// API 接口
router.get("/api/data", async (c) => {
	return c.json({ ok: true });
});

export const <name>Routes = router;
```

### 3. 创建 client.tsx

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

	return <div>{/* 页面内容 */}</div>;
};

export function mount(el: HTMLElement) {
	render(<MyClient />, el);
}
```

### 4. 创建 action.ts

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
	// CLI 逻辑...
};
```

### 5. 注册到各入口文件

**server.tsx** — 注册路由：

```tsx
import { <name>Routes } from "./commands/<name>/routes";
app.route("/<name>", <name>Routes);
```

**shared/menus.ts** — 注册菜单：

```ts
import { meta as <name> } from "../commands/<name>/meta";
export const menus: CommandMeta[] = [config, release, <name>];
```

**client.ts** — 注册客户端模块：

```ts
import { meta as <name> } from "./commands/<name>/meta";
const routes = {
	[<name>.href]: () => import("./commands/<name>/client"),
};
```

**commands/index.ts** — 注册 action：

```ts
export { <name>Action } from "./<name>/action";
```

**cli.ts** — 注册 CLI 命令：

```ts
import { <name>Action } from "./commands";
cli.command("<name>", "命令描述").option("-o, --open", "打开页面").action(<name>Action);
```

### Checklist

- [ ] `src/commands/<name>/meta.ts` — 菜单元数据
- [ ] `src/commands/<name>/routes.tsx` — 路由 + API
- [ ] `src/commands/<name>/client.tsx` — 客户端组件
- [ ] `src/commands/<name>/action.ts` — CLI 入口
- [ ] `src/server.tsx` — 注册路由
- [ ] `src/shared/menus.ts` — 注册菜单
- [ ] `src/client.ts` — 注册客户端模块
- [ ] `src/commands/index.ts` — 注册 action
- [ ] `src/cli.ts` — 注册 CLI 命令
