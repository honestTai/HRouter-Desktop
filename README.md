<div align="center">

<img src="src-tauri/icons/128x128.png" width="88" alt="HRouter Desktop logo">

# HRouter Desktop

**Your agents. Your providers. One focused desktop workbench.**

Connect AI coding tools to the model services you choose.<br>
Manage providers, API keys, model mappings, profiles, routing, and usage—without turning your desktop into an account portal.

[Download](https://github.com/honestTai/HRouter-Desktop/releases/latest) · [Features](#features) · [What changed from CC Switch?](#what-changed-from-cc-switch) · [Screenshots](#screenshots) · [简体中文](#简体中文)

**macOS · Windows · Local-first · MIT licensed**

</div>

![HRouter Desktop agent workbench](assets/screenshots/workbench-en.png)

## Meet HRouter

<table>
<tr>
<td width="100" align="center"><a href="https://hrouter.net/"><img src="src-tauri/icons/128x128.png" width="72" alt="HRouter"></a></td>
<td>
<strong>Already have an HRouter key? Put it to work.</strong><br><br>
Choose your agent, paste your HRouter API key, discover the models available to that key, and review the generated configuration. Spend less time editing config files and more time building.<br><br>
<a href="https://hrouter.net/"><strong>Visit HRouter →</strong></a> · Manage your service account and keys on the website; configure your coding tools in the desktop app.
</td>
</tr>
</table>

**HRouter is optional.** Official providers, self-hosted endpoints, and other compatible API services remain first-class choices. This is a project-service promotion, not a requirement to buy a plan. Model availability, pricing, and service terms are determined by the service and your key—not by the screenshots or this README.

## Why this fork?

HRouter Desktop builds on **[CC Switch](https://github.com/farion1231/cc-switch)** and gives the workflow a different center of gravity: **pick an agent → connect a service → check compatibility → protect local configuration → choose routes → inspect usage**.

The v0.4.0 workbench keeps the desktop focused. It removes HRouter's embedded platform login, account management, payments, orders, announcements, and cloud billing pages. The HRouter integration is now an optional **API-key quick setup**, alongside normal provider configuration.

This is an independently maintained distribution, not an official CC Switch release and not a claim that upstream lacks the shared features below.

## Download

Use the assets attached to a **published release**:

| Platform | Package          | Notes                                                                                                                    |
| -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| macOS    | Universal `.dmg` | Apple Silicon and Intel; macOS 12+. The macOS publication pipeline requires Developer ID signing and Apple notarization. |
| Windows  | x64 `-setup.exe` | NSIS installer. Tauri updater signatures are separate from Windows Authenticode signing.                                 |

[Latest published release](https://github.com/honestTai/HRouter-Desktop/releases/latest) · [All releases](https://github.com/honestTai/HRouter-Desktop/releases) · [Changelog](CHANGELOG.md) · [Signing policy](CODE_SIGNING_POLICY.md)

> **Release status — October 3, 2026:** `main` is on **v0.4.0**. Its Windows package has been built, but the release is still a draft while macOS notarization awaits an Apple developer agreement update. The latest public release remains **v0.3.1**. A source version or Git tag is not a promise that its installers are already published.

## Features

| Area                                  | What you can do                                                                                                                                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent workbench**                   | Choose an agent and move between connection setup, compatibility checks, protection, routes, and local costs. See which tools have a provider configured.                                                                                      |
| **Provider configuration**            | Keep multiple providers per agent; use presets or a custom endpoint, key, and model configuration. Review the active provider, edit, duplicate, and switch.                                                                                    |
| **HRouter key quick setup**           | Enter an existing key without signing into a platform account. Discover the key's model list and review agent-specific model mappings and generated configuration before saving.                                                               |
| **Connection checks**                 | For supported Claude Code / Codex API-key providers, check the model catalog and optionally test text, streaming, tool calls, and tool-result continuation. Full checks require explicit acknowledgement and may incur provider charges.       |
| **Configuration protection**          | Opt into Claude Code / Codex field-preserving switches, preview changes, save local snapshots, and restore only when conflict checks pass. Preserve unrelated Hooks, permissions, MCP settings, and custom fields within the documented scope. |
| **Lite mode**                         | Manage connection fields without application-managed MCP, Skills, or prompt writes. Combine device-local prompt protection with provider-only sync scope. Existing extensions are not uninstalled.                                             |
| **Access profiles**                   | Save provider, MCP, and Skill selections; preview before applying a profile. Profiles reference providers rather than freezing a complete copy of each provider's configuration.                                                               |
| **Routing and failover**              | Opt into local routing for supported agents, choose an ordered backup queue, and define exact-model primary/backup rules. No HRouter channel is automatically inserted into your queue.                                                        |
| **Usage and cost visibility**         | Inspect local requests, tokens, cache usage, trends, provider/model summaries, and configured pricing. Query provider-level usage when available. These are local estimates or provider-query results, not a replacement for invoices.         |
| **Codex continuity**                  | Preserve compatible legacy provider identities at runtime when switching services, without rewriting session history. Optional proxy-side session compatibility has explicit limits for upstream-only context.                                 |
| **Session tools**                     | Browse supported local agent sessions, inspect messages and project context, and resume a session with the relevant client.                                                                                                                    |
| **MCP and Skills**                    | Manage shared resources with per-agent enablement; add MCP servers, discover Skills, import existing resources, and use supported ZIP/backup workflows. Adapter support varies.                                                                |
| **Agent-specific tools**              | OpenClaw workspace files, environment variables, tool permissions, and defaults; Hermes memory and user-profile editing. These panels appear when the corresponding agent is selected.                                                         |
| **Desktop utilities**                 | Agent installation/update entry points, a floating usage window, a macOS widget integration, language/theme preferences, and in-app help. The CLI installer does not install every agent's desktop GUI.                                        |
| **Migration and environment targets** | Read-only CC Switch database preview and selective provider import. Claude / Codex API-key configurations also support previewed deployment to existing Windows / WSL-accessible target directories.                                           |

### Supported agents

**Claude Code · Claude Desktop · Codex · Gemini CLI · Grok Build · OpenCode · OpenClaw · Hermes · Pi Agent · DeepSeek Harness · WorkBuddy**

“Supported” means an agent-specific integration exists; it does **not** mean every agent supports identical routing, MCP, Skills, authentication, usage import, or installation behavior. Configuration protection and real-request connection checks have a narrower scope than basic provider setup.

Implementation details and limits: [Access workbench](docs/access-workbench.md) · [Fixes and acceptance boundaries](docs/issue-remediation.md).

## What changed from CC Switch?

**Shared foundation, different workflow.** CC Switch already provides provider switching, local proxy/protocol conversion, failover, MCP, Skills, prompts, sessions, usage, and sync infrastructure. We retain substantial upstream code and credit; these are not presented as HRouter inventions.

The following describes changes maintained **in this fork**, not a live “upstream cannot do this” checklist:

| Area                               | HRouter's changes                                                                                                                                                                                        | Important boundary                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Interface and navigation**       | Reworked the application into a top-navigation, agent-first workbench with dedicated Configuration, Profiles, Route policies, and Usage pages. Simplified Settings to the essential General/About views. | This is a workflow/UI redesign, not a new underlying proxy engine.                                                       |
| **HRouter integration**            | Added key discovery, agent-specific model mapping, generated-config review, provider usage, and HRouter-focused setup. v0.4.0 removes this fork's former embedded account/payment/cloud-billing modules. | Removing those modules is a change from earlier HRouter versions—not a claim that CC Switch had them.                    |
| **Protection and Lite mode**       | Added an explicit protection workflow with field-preserving writes, preview fingerprints, local snapshots, guarded restores, prompt protection, and provider-only sync scope.                            | Claude / Codex have the strongest field-level guarantees; snapshots contain credentials and must be protected.           |
| **Profiles**                       | Added a dedicated workflow for saved provider/MCP/Skill selections and previewed application.                                                                                                            | A profile is not a full backup, and prompt files are outside its scope.                                                  |
| **Model-aware routes**             | Extended the inherited routing/failover foundation with exact-model route chains, temporary manual preference behavior, and explicitly confirmed multi-key quota aggregation.                            | Session affinity, cross-model quality, and reusable upstream context are not guaranteed.                                 |
| **Compatibility checks and fixes** | Added protocol-aware test stages, configuration/credential consistency checks, and transport fixes around configured HTTP proxies and header handling.                                                   | Passing a small test does not certify all agent tasks; known upstream reports are not automatically considered resolved. |
| **Codex and usage correctness**    | Maintains legacy-provider runtime aliases and targeted fixes for Codex fork usage, Claude cache-TTL estimates, and OpenCode rollup/deduplication.                                                        | Old missing source data cannot be reconstructed; these are scoped fixes, not a blanket accounting guarantee.             |
| **Agent and desktop integrations** | Maintains additional DeepSeek Harness / WorkBuddy setup, agent-scoped desktop usage, and macOS widget work, alongside inherited adapters.                                                                | Agent rosters and capabilities evolve independently in both projects.                                                    |
| **Migration**                      | Added read-only preview and selective import from a CC Switch database without activating imported entries or changing the source.                                                                       | OAuth sessions, prompts, Skills, usage scripts, and other excluded data are not migrated.                                |

For a reproducible reference, the upstream capability overview was checked against [CC Switch README at `793e67d`](https://github.com/farion1231/cc-switch/blob/793e67d9b3210eb527e7d36f2c866a56fae9dec7/README.md). HRouter's scope is documented in [the workbench guide](docs/access-workbench.md), [the issue-by-issue checklist](docs/issue-remediation.md), and [upstream contribution notes](docs/upstream-contributions.md). The latter are dated records, not a promise about today's PR status.

## Screenshots

Selected **real macOS desktop captures**, taken on October 3, 2026. These are full-window captures, not browser mockups. Private configuration labels have opaque redactions; empty states are real. The UI is set to English, although some HRouter-specific form labels still appear in Chinese. Long pages use separate scroll positions rather than claiming one image shows every off-screen control.

The locally rebuilt capture app still reports `0.3.1` in its bundle metadata; it already contains the simplified workbench. These screenshots demonstrate the UI, not proof that the v0.4.0 release has been published. [Capture and privacy notes](assets/screenshots/README.md).

<details open>
<summary><strong>Providers and HRouter key setup</strong></summary>

Save multiple services and keep the selected provider visible. HRouter quick setup is separate from the general provider path; no account login is required.

![Provider configuration](assets/screenshots/configuration-en.png)
![HRouter key quick setup with an empty credential field](assets/screenshots/key-setup-en.png)

</details>

<details>
<summary><strong>Connection checks and configuration protection</strong></summary>

Check compatibility deliberately. Review protection scope, recent snapshots, and independent environment targets without silently rewriting unrelated configuration.

![Connection checks](assets/screenshots/connection-check-en.png)
![Protection and Lite mode](assets/screenshots/protection-en.png)
![Protection snapshots and environment targets, lower scroll position](assets/screenshots/protection-targets-en.png)

</details>

<details>
<summary><strong>Access profiles and routing policies</strong></summary>

Save repeatable selections and choose backup behavior explicitly. A configured policy is not the same as an enabled local proxy.

![Access profiles](assets/screenshots/profiles-en.png)
![Route policies](assets/screenshots/route-policies-en.png)

</details>

<details>
<summary><strong>Sessions, MCP, and Skills discovery</strong></summary>

Keep everyday agent resources close to connection settings. The session screenshot uses an empty agent filter rather than exposing private conversations.

![Session Manager with an empty agent filter](assets/screenshots/sessions-en.png)
![MCP management](assets/screenshots/mcp-en.png)
![Skills discovery](assets/screenshots/skills-discovery-en.png)

</details>

<details>
<summary><strong>Preferences and desktop usage</strong></summary>

Keep language, appearance, agent visibility, and window behavior simple. The floating usage window follows the selected agent; this example shows an agent with no recorded usage.

![General preferences, lower scroll position](assets/screenshots/settings-behavior-en.png)

<img src="assets/screenshots/usage-widget-en.png" width="480" alt="Floating agent usage window">

</details>

## Quick start

1. **Install a published package** and open **Agents**.
2. **Select your agent.** Its integration determines which controls and configuration formats are available.
3. **Add a provider.** Use an official preset or enter your own compatible endpoint and API key. For HRouter, choose **Add HRouter key**, enter an existing key, and review the discovered models and mappings.
4. **Review, save, and enable.** Confirm the model and generated configuration before switching. Restart or refresh the target client if it requires it.
5. **Add only what you need.** Enable protection, profiles, routing, MCP, or Skills deliberately. Start with a catalog check before opting into any billable real-request test.

### Coming from CC Switch or an older HRouter version?

- In **Agents → Connect**, select the actual `cc-switch.db` file for a **read-only preview**, then import only the providers you want. The importer leaves the source database and active client configuration alone, and skips existing entries.
- This is **provider migration**, not a whole-account migration. Prompts, Skills, usage scripts, managed OAuth sessions, and OMO configuration are excluded.
- Upgrading HRouter does not require deleting existing providers, API keys, or agent configuration directories. Removed platform pages return to the workbench; account and payment operations belong on the website.
- Legacy Codex aliases are maintained in runtime configuration where appropriate. HRouter does not rewrite historical JSONL conversations or recover context stored only on a previous provider's servers.

## Privacy and operational boundaries

- **Local-first is not “never uses the network.”** Model discovery, usage queries, configured providers, Skills discovery, pricing data, and updates can contact their respective services. Keys authenticate requests to the provider you choose.
- **Treat local files as sensitive.** Provider records, agent config files, and switch snapshots can contain credentials. Do not publish them with issue reports, screenshots, or sync backups.
- **Costs are estimates.** Token imports, configured rates, cache policy, source retention, and provider billing can differ. A successful request does not prove a provider's model identity or quality.
- **Opt-in tests may cost money.** Full connection checks use fixed content, not your conversations, and test simulated tool results rather than executing tools. They still send model requests.
- **Use the documented scope.** Snapshot restore rejects conflicting edits; multi-target deployment requires existing reachable paths; provider-only sync is not a complete backup.

[Privacy policy](PRIVACY.md) · [Security reporting](SECURITY.md) · [Signing policy](CODE_SIGNING_POLICY.md)

## Development

Built with **Tauri 2, Rust, React, and TypeScript**. Reuse the project's lockfiles and `pnpm@10.12.3`; install platform-specific Tauri build prerequisites before building.

```bash
git clone https://github.com/honestTai/HRouter-Desktop.git
cd HRouter-Desktop
pnpm install --frozen-lockfile
pnpm dev
```

```bash
pnpm typecheck
pnpm format:check
pnpm test:unit
pnpm build:renderer
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

`pnpm build` creates bundles for the host platform. Windows installers are built on Windows; the release pipeline builds a macOS Universal bundle with signing and notarization. The v0.4.0 publication gate waits for CI, both installers, and a combined signed updater manifest before making the release public. See [macOS signing](docs/macos-signing.md) and [contribution guidelines](CONTRIBUTING.md).

## Credits and license

HRouter Desktop contains substantial portions of **CC Switch**, originally created by **Jason Young** and its contributors. The original MIT copyright and license are retained. HRouter-specific product changes are maintained independently by HRouter Contributors.

This project is **not endorsed or supported by the original CC Switch maintainers** unless they explicitly state otherwise. Some internal `cc-switch` identifiers remain for compatibility, migration, and session continuity.

[MIT License](LICENSE) · [Attribution notice](NOTICE.md) · [Report an issue](https://github.com/honestTai/HRouter-Desktop/issues)

---

## 简体中文

### 为你的 Agent 选择服务，而不是围绕平台账户使用工具

**HRouter Desktop 是一个本地优先的 AI 编程工具配置工作台。** 集中管理供应商、API Key、模型映射、接入方案、线路和用量，同时支持官方服务、自建端点以及其他兼容 API。

核心流程：**选择 Agent → 添加服务 → 检查兼容性 → 保护本地配置 → 按需启用主备线路 → 查看用量。**

v0.4.0 将重做后的工作台作为主线，移除了旧版 HRouter 内置的平台登录、账户管理、充值、订单、公告和云端账单。**HRouter 仅保留可选的 Key 快捷配置；无需桌面端平台登录，也不强制购买或使用 HRouter 服务。**

### HRouter 推广

> **已有 HRouter Key？让它直接接入你的编程工具。**
>
> 选择 Agent，粘贴 Key，发现该 Key 可用的模型，检查映射和生成的配置，再保存使用。少花时间手改配置，把时间留给开发。
>
> **[访问 HRouter →](https://hrouter.net/)**
>
> 服务账户和密钥在网站管理，编程工具在桌面配置。模型、价格和服务条款以网站及实际 Key 权限为准。这里是项目服务推广，不是功能使用门槛；其他兼容供应商同样可以正常接入。

### 主要功能

| 功能                   | 说明                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent 工作台与配置中心 | 同一处选择工具、保存多套供应商、查看当前接入、编辑和切换配置。                                                                                   |
| HRouter Key 快捷配置   | 无需平台登录；发现模型、调整 Agent 专属映射、检查生成配置。                                                                                      |
| 接入体检               | 支持范围内的 Claude / Codex API Key 供应商可检查模型目录；主动确认后再测试普通响应、流式、工具调用和工具结果续接。真实请求可能计费。             |
| 配置保护与 Lite 模式   | Claude / Codex 按范围保留自定义字段；切换前预览、留存本地快照、恢复时检查冲突。Lite 模式停用应用管理的 MCP、Skills、提示词写入，并限制同步范围。 |
| 接入方案               | 保存供应商、MCP、Skills 的选择，应用前预览；不是完整配置备份，供应商后续修改仍会影响引用它的方案。                                               |
| 模型线路与故障转移     | 配置有序主备队列和精确模型匹配；支持的 Agent 可主动开启本地代理，不会自动加入 HRouter 渠道。                                                     |
| 本地用量与费用         | 请求、Token、缓存、趋势、供应商/模型汇总及计价规则；支持已配置的供应商用量查询，不等同于真实账单。                                               |
| 会话与 Codex 兼容      | 浏览并恢复支持的本地会话；针对旧 provider 标识维护运行时兼容，不改写历史对话。                                                                   |
| MCP、Skills 与专属工具 | 按 Agent 管理资源；包含 Skills 发现和支持的导入/备份流程，以及 OpenClaw 工作区配置、Hermes 记忆等专属页面。                                      |
| 桌面辅助与迁移         | CLI 安装/更新入口、浮动用量窗口、macOS 小组件集成、语言主题设置；只读预览 CC Switch 数据库并选择性导入供应商。                                   |

支持：**Claude Code、Claude Desktop、Codex、Gemini CLI、Grok Build、OpenCode、OpenClaw、Hermes、Pi Agent、DeepSeek Harness、WorkBuddy。**

各 Agent 的配置、代理、MCP、Skills、认证和用量能力并不完全一致。配置保护、真实请求体检、多环境部署都有明确范围，详见[接入工作台说明](docs/access-workbench.md)。

### 相比 CC Switch，改了哪些东西？

首先保留上游贡献：**供应商切换、代理与协议转换、基础故障转移、MCP、Skills、提示词、会话、用量和同步基础设施并非本项目原创。** HRouter 是独立分支，不代表 CC Switch 官方，也不宣称以下能力都是“上游没有的”。

本分支持续维护的改动主要包括：

1. **重做交互结构**：顶部导航、Agent 优先的工作台，配置中心、接入方案、线路与用量分开组织；设置收敛为常用项和关于页。
2. **保留轻量 HRouter 接入**：Key 识别、模型映射、生成配置和供应商用量；删除的是旧版 **HRouter 自己的**账户、充值及云端账单模块，并非声称 CC Switch 有这些模块。
3. **增加显式保护流程**：配置差异预览、指纹校验、本地快照、冲突恢复、Lite 模式、独立提示词保护和仅供应商同步范围。
4. **增加接入方案与模型级线路工作流**：保存并预览应用选择；在已有代理基础上扩展精确模型主备链、临时手动优先和有条件的多 Key 额度合计。
5. **加强接入验证和针对性修复**：按协议检查真实响应、流式和工具续接；维护代理传输修复、Codex 会话标识兼容、fork 用量、Claude 缓存 TTL、OpenCode 汇总去重等改动。
6. **扩展 Agent 与桌面体验**：维护 DeepSeek Harness / WorkBuddy 接入、Agent 维度用量窗口和 macOS 小组件；另有只读迁移及独立 Windows / WSL 目标配置流程。

这些是本分支的实现范围，不是“全面优于上游”的承诺，也不代表上游相关 Issue 已全部解决。英文[改动对照表](#what-changed-from-cc-switch)保留了比较基准；[修复与验收清单](docs/issue-remediation.md)列出已验证和未覆盖的边界。

### 截图与安装

上方[界面截图](#screenshots)精选了真实 macOS 窗口，包含 Key 配置、配置中心、体检、保护、接入方案、线路、会话、MCP、Skills 和桌面组件。私人配置名称已做不可逆遮盖；没有填入真实 Key，也没有伪造模型请求或用量数据。英文界面中仍有少量 HRouter 专属中文文案，如实保留。

- 从 [GitHub Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest) 下载**已经公开发布**的安装包：macOS Universal DMG 或 Windows x64 EXE。
- **截至 2026 年 10 月 3 日**：主分支版本为 v0.4.0，Windows 包已构建；macOS 公证仍等待 Apple 开发者协议更新，因此 v0.4.0 保持草稿，公开最新版仍为 v0.3.1。
- 安装后选择 Agent，添加普通供应商或已有 HRouter Key，检查模型和配置，再保存并启用。按客户端要求重启或刷新。
- 从 CC Switch 迁移时选择实际数据库，先只读预览，再导入所需供应商；不会激活导入项或修改源库，也不会迁移 OAuth 登录态、提示词、Skills、用量脚本等排除项。
- 老版 HRouter 升级无需清空 Key 或配置。账户、充值和订单请在网站操作。

### 隐私、边界与开源归属

本地优先不等于完全离线：模型发现、供应商调用、用量查询、Skills 发现和更新等会访问相应服务。Key 和快照可能以配置文件形式保存在本机，请勿随截图、Issue 或备份公开。费用是本地估算，体检通过也不保证上游模型身份、质量或长任务稳定性。

项目基于 **CC Switch**，保留 **Jason Young** 及原作者的 MIT 版权和归属。HRouter 品牌与产品改动独立维护，不代表上游官方发行或背书。

[隐私政策](PRIVACY.md) · [安全反馈](SECURITY.md) · [许可证](LICENSE) · [归属声明](NOTICE.md) · [参与开发](#development)

---

Maintained by [honestTai](https://github.com/honestTai). Built on CC Switch, with thanks to its contributors.
