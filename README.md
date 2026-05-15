<div align="center">

# FlowPilot

**桥接 Jira & GitLab — 自动化你的发布流程**

[![npm version](https://img.shields.io/npm/v/flowpilot.svg)](https://www.npmjs.com/package/flowpilot)
[![node](https://img.shields.io/node/v/flowpilot.svg)](https://www.npmjs.com/package/flowpilot)
[![license](https://img.shields.io/npm/l/flowpilot.svg)](https://www.npmjs.com/package/flowpilot)

</div>

---

## FlowPilot 是什么？

FlowPilot 是一个 CLI + Web Dashboard 工具，将 **Jira** 和 **GitLab** 连接起来，让发布申请流程自动化：

- 从 GitLab 项目分支自动提取 `pom.xml` 版本号
- 在 Jira 自动创建或复用发布版本
- 一键生成发布申请 Issue，链接自动复制到剪贴板

所有配置和凭证仅存储在本地 `~/.flowpilotrc`，不会发送到任何外部服务。

---

## 快速开始

### 安装

```bash
# 全局安装（需要 Node.js >= 22.13）
npm install -g flowpilot
```

### 首次配置

```bash
# CLI 交互式配置
flowpilot config

# 或者打开 Web 页面配置
flowpilot config --open
```

需要填写以下信息：

| 配置项 | 说明 |
|--------|------|
| **Jira 地址** | 带协议前缀，如 `https://jira.example.com` |
| **Jira 账号** | 用户名（无 @ 后缀） |
| **Jira 密码** | 仅本地存储 |
| **GitLab 地址** | 带 protocol 前缀，如 `http://git.example.com` |
| **GitLab Token** | 在 GitLab Settings → Access Tokens 生成 |

### 创建发布申请

```bash
# CLI 交互式流程
flowpilot release

# 或者打开 Web 页面操作
flowpilot release --open
```

---

## CLI 命令

```
flowpilot config          交互式配置账号信息
flowpilot config -o       打开 Web 配置页面
flowpilot release         创建发布申请（CLI）
flowpilot release -o      打开 Web 发布页面
flowpilot serve           启动后台服务
flowpilot stop            停止后台服务
flowpilot restart         重启后台服务
flowpilot update          更新到最新版本
```

---

## Web Dashboard

启动服务后访问 `http://127.0.0.1:8787`，提供两个页面：

### 配置页面 `/config`

在浏览器中填写和修改 Jira / GitLab 凭证，保存即时生效。

### 发布页面 `/release`

通过可视化界面完成发布流程：

1. **选择项目** — 从 GitLab 搜索并选择项目
2. **选择分支** — 选择要发布的分支
3. **查看版本** — 自动从 `pom.xml` 提取版本信息
4. **选择 Jira 项目** — 关联到对应的 Jira 项目
5. **创建 Issue** — 自动创建发布申请，如已存在则直接获取链接

---

## 发布流程详解

无论是 CLI 还是 Web Dashboard，发布流程的核心步骤如下：

```
┌─────────────────────────────────────────────────────┐
│  1. 解析 GitLab项目                                  │
│     git remote → 自动识别 / 手动搜索选择              │
├─────────────────────────────────────────────────────┤
│  2. 选择分支                                         │
│     获取所有分支 → 选择目标发布分支                    │
├─────────────────────────────────────────────────────┤
│  3. 提取版本号                                       │
│     从 pom.xml 解析 groupId / artifactId / version   │
├─────────────────────────────────────────────────────┤
│  4. 关联 Jira 项目                                  │
│     选择目标 Jira 项目 Key                            │
├─────────────────────────────────────────────────────┤
│  5. 检查已有 Issue                                  │
│     搜索同版本 Issue → 如已存在直接返回链接            │
├─────────────────────────────────────────────────────┤
│  6. 确保 Jira 版本                                  │
│     检查版本是否存在 → 不存在则自动创建                │
├─────────────────────────────────────────────────────┤
│  7. 创建发布 Issue                                  │
│     生成 Issue → 链接自动复制到剪贴板                 │
└─────────────────────────────────────────────────────┘
```

---

## 配置文件

凭证存储在 `~/.flowpilotrc`（JSON 格式）：

```json
{
  "jiraHost": "https://jira.example.com",
  "jiraName": "your-username",
  "jiraPassword": "your-password",
  "gitlabHost": "http://git.example.com",
  "gitlabKey": "glpat-xxxxxxxxxxxxxxxxxxxx"
}
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 服务端框架 | Hono |
| 客户端渲染 | hono/jsx + hono/jsx/dom |
| 构建 | Rolldown（client 支持代码分包） |
| CLI 解析 | cac |
| 交互提示 | @clack/prompts + @inquirer/search |
| 国际化 | i18next（中文 / 英文自动检测） |
| 测试 | Vitest |
| 代码规范 | Biome |

---

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（监听变化自动重建）
pnpm dev

# 构建
pnpm build

# 测试
pnpm test

# 代码检查
pnpm check
```

---

## 发布

```bash
# 小版本更新 (0.0.x)
pnpm release:patch

# 功能更新 (0.x.0)
pnpm release:minor

# 大版本更新 (x.0.0)
pnpm release:major
```

---

## License

ISC