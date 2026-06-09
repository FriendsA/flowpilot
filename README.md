<div align="center">

# FlowPilot

**Jira & GitLab 工作流自动化工具 — 从开发到发布，一站式搞定**

[![npm version](https://img.shields.io/npm/v/flowpilot.svg)](https://www.npmjs.com/package/flowpilot)
[![node](https://img.shields.io/node/v/flowpilot.svg)](https://www.npmjs.com/package/flowpilot)
[![license](https://img.shields.io/npm/l/flowpilot.svg)](https://www.npmjs.com/package/flowpilot)

</div>

---

## 是什么？

FlowPilot 将 **Jira** 和 **GitLab** 串联起来，把日常开发工作流中的重复操作自动化：

- 配置 Jira / GitLab / Jenkins 凭证
- 创建发布申请（自动提取版本号、创建 Jira Issue）
- 结束当前任务（rebase → push → 创建 MR → 更新 Jira）
- 创建 Merge Request（选分支 → push → 创建 MR → 触发流水线）
- 更多流程持续增加中…

所有凭证仅存储在本地 `~/.flowpilot/config.json`，不会发送到任何外部服务。支持中文 / 英文自动切换。

---

## 安装

```bash
npm install -g flowpilot
```

需要 Node.js >= 22.13。

---

## 首次配置

```bash
flowpilot config          # CLI 交互式配置
flowpilot config --open   # 打开 Web 页面配置
```

| 配置项 | 说明 |
|--------|------|
| **Jira 地址** | 带协议前缀，如 `https://jira.example.com` |
| **Jira 账号** | 用户名（无 @ 后缀） |
| **Jira 密码** | 仅本地存储 |
| **GitLab 地址** | 带协议前缀，如 `http://git.example.com` |
| **GitLab Token** | 在 GitLab Settings → Access Tokens 生成 |
| **Jenkins 地址** | 带协议前缀，如 `https://jenkins.example.com` |
| **Jenkins 账号** | 用户名 |
| **Jenkins 密码** | 密码 / API Token，仅本地存储 |

---

## 使用方式

每个命令都支持 CLI 交互和 Web 页面两种操作方式，`--open` 在浏览器中打开对应的操作页面。

所有带输入的命令支持**历史记录快速执行**：保存每次的输入数据，下次一键复用，无需重新填写。

| 命令 | 描述 |
|------|------|
| `flowpilot config` | 配置凭证（Jira、GitLab、Jenkins） |
| `flowpilot release` | 创建发布申请（自动提取版本号并创建 Jira Issue） |
| `flowpilot end` | 完成当前任务（自动 rebase、push、创建 MR、更新 Jira） |
| `flowpilot mr` | 创建 Merge Request（自动生成标题和描述） |
| `flowpilot watch` | 监控 Jenkins 构建（每 60 秒自动轮询） |
| `flowpilot serve` | 启动 Web 服务 |
| `flowpilot stop` | 停止 Web 服务 |
| `flowpilot restart` | 重启 Web 服务 |
| `flowpilot update` | 更新 FlowPilot 到最新版本 |

### 发布申请

自动从 GitLab 项目分支提取 `pom.xml` 版本号，在 Jira 创建发布 Issue，链接自动复制到剪贴板。

**变量提取规则：**
- **版本号**：从 `pom.xml` 的 `<version>` 标签提取（自动去除 `-SNAPSHOT` 等后缀）
- **发布名称（releaseName）**：优先从 `pom.xml` 的 `<flowpilot><releaseName>` 提取；回退到 `<properties><flowPilotName>`；最终回退到 GitLab 项目名称
- **Jenkins 任务（jenkinsJob）**：优先从 `pom.xml` 的 `<flowpilot><jenkinsJob>` 提取；回退到 `<properties><jenkinsJobName>`
- **Jira 版本名**：`{releaseName}-{version}`，如 `my-service-1.2.3`
- **Issue 概要**：`{releaseName}-{version} release request`

完整的 pom.xml 配置说明见 [POM Configuration](docs/pom-configuration.md)

```bash
flowpilot release          # CLI
flowpilot release --open   # 在浏览器中打开发布页面
```

### 结束任务

完成功能分支的全部收尾：rebase、push、创建 MR（自动关联 Jira issue）、更新 Jira 状态。

```bash
flowpilot end               # 自动检测源分支
flowpilot end -b develop    # 指定目标分支
flowpilot end --open        # 在浏览器中打开任务完成页面
```

### 创建 Merge Request

选择源分支与目标分支，自动推送并创建 MR，支持流水线触发和 Jira 状态更新。

```bash
flowpilot mr                # CLI 交互式
flowpilot mr -t develop     # 指定目标分支
flowpilot mr --draft        # 创建为草稿 MR
flowpilot mr --open         # 在浏览器中打开 MR 创建页面
```

### 监控 Jenkins 构建

实时监控 Jenkins 流水线的构建状态，每 60 秒自动轮询更新。

```bash
flowpilot watch --open      # 在浏览器中打开监控页面
```

### 服务管理

```bash
flowpilot serve     # 启动 Web 服务
flowpilot stop      # 停止 Web 服务
flowpilot restart   # 重启 Web 服务
```

---

## License

ISC