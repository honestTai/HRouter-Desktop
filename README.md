<div align="center">

# HRouter Desktop

<img src="src-tauri/icons/128x128.png" width="96" alt="HRouter Desktop">

**接入你选择的模型服务，配得好、切得稳、费用看得清。**

**Connect your AI coding tools to the providers you choose.**

[Windows 下载](https://github.com/honestTai/HRouter-Desktop/releases/download/v0.3.1/HRouter_0.3.1_x64-setup.exe) · [macOS 下载](https://github.com/honestTai/HRouter-Desktop/releases/download/v0.3.1/HRouter_0.3.1_universal.dmg) · [所有版本 / Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest) · [HRouter](https://hrouter.net/home)

</div>

把模型识别、路由配置和用量查询放进一个桌面客户端，减少在不同工具的配置文件之间来回切换。

Discover models, configure routing, and track usage in one desktop app instead of juggling configuration files.

**适合谁 / Who it’s for**  
同时使用多个 AI 编程工具，希望集中配置模型与查看用量的开发者。  
Developers who use multiple AI coding tools and want a central place for model configuration and usage.

> Based on [CC Switch](https://github.com/farion1231/cc-switch), licensed under MIT. 原作者版权与许可证声明保留。

## 下载与接入 · Download & connect

**v0.3.1** 为接入工作台界面修正版，安装包及各平台发布状态以 [Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest) 为准。

| 平台 / Platform | 安装包 / Installer |
| --- | --- |
| Windows x64 | [下载 EXE / Download EXE](https://github.com/honestTai/HRouter-Desktop/releases/download/v0.3.1/HRouter_0.3.1_x64-setup.exe) |
| macOS Universal | [下载 DMG / Download DMG](https://github.com/honestTai/HRouter-Desktop/releases/download/v0.3.1/HRouter_0.3.1_universal.dmg) |

**当前源码：打开接入工作台 → 添加任意供应商或导入 CC Switch 配置 → 检查接入 → 按需开启配置保护和主备线路。**

**Current source: open the workbench → add or import providers → check compatibility → configure protection and failover.**

> v0.3.0 包含接入工作台。功能范围和使用说明见 [接入工作台](docs/access-workbench.md)。

## 功能

- 支持官方预设和自定义供应商；通用功能无需 HRouter 账号。
- 可只读预览并导入 CC Switch 供应商，不自动启用、不覆盖原数据库。
- Claude Code / Codex 接入体检：模型目录、普通响应、流式响应和工具调用；真实请求由用户主动勾选执行。
- 可选本机配置保护：字段差异预览、切换快照、检测冲突后恢复。
- 主备线路工作台、本地估算和 HRouter 服务端账单核对、页面余额提醒。
- 同一个 Agent 可以保存多个 HRouter Key 配置并快速切换。
- 使用当前 Key 实时获取可用模型。
- 自动预填默认模型和模型映射，保存前仍可手动调整。
- 支持 Claude Code、Claude Desktop、Codex、Gemini CLI、Grok Build、OpenCode、OpenClaw 和 Hermes。
- 自动查询近 30 天用量：订阅 Key 显示总额度、已用和剩余；按量 Key 显示消费与余额。
- 提供按模型统计的请求量、Token 和费用信息。

## 快速开始

1. 安装 v0.3.1 或从源码启动，进入“接入工作台”。
2. 选择 Claude Code 或 Codex，添加官方预设、自定义 API 服务，或迁移 CC Switch 供应商。其他 Agent 在配置中心选择。
3. 如使用 HRouter，选择“HRouter 快捷接入”，填写 Key 并识别模型；没有 Key 可自行前往 [HRouter](https://hrouter.net/) 注册。
4. 在“接入体检”中查询目录，按需勾选真实请求测试。
5. 在“配置保护”中主动开启保护，预览后切换；按客户端要求重启以加载配置。
6. 按需配置主备线路，查看本地估算或登录 HRouter 查询服务端账单。

> GitHub Releases 提供 Windows x64 和 macOS Universal 安装包；开发者也可以按照下面的说明从源码运行。

## 从源码运行

需要 Node.js 20、pnpm、Rust 1.85+，以及当前系统对应的 [Tauri 2 开发依赖](https://v2.tauri.app/start/prerequisites/)。

```bash
git clone https://github.com/honestTai/HRouter-Desktop.git
cd HRouter-Desktop
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

常用检查命令：

```bash
pnpm typecheck
pnpm format:check
pnpm test:unit
cargo test --manifest-path src-tauri/Cargo.toml
```

## 安全

- 用户 Key 是运行时配置，不应提交到 Git 仓库、Issue、日志或截图中。
- 报告安全问题时请使用 [GitHub Security Advisories](https://github.com/honestTai/HRouter-Desktop/security/advisories/new)，不要公开提交包含凭据的 Issue。

## Code signing policy

For releases approved under this policy, free code signing is provided by
[SignPath.io](https://signpath.io/), with a certificate provided by the
[SignPath Foundation](https://signpath.org/). The application is pending; the
v0.2.1 Windows installer is not Authenticode-signed.

See the full [code signing policy](CODE_SIGNING_POLICY.md) and
[privacy policy](PRIVACY.md). The Apple Developer ID setup and release checks
are documented in [docs/macos-signing.md](docs/macos-signing.md).

## 与 CC Switch 上游的关系

- 上游仓库：<https://github.com/farion1231/cc-switch>
- 上游许可证：MIT
- HRouter 会按需参考上游更新，不保证与 CC Switch 功能或发布节奏一致。
- 代码中保留的部分 `cc-switch` 内部标识用于兼容配置、迁移和历史数据，不代表产品品牌。

详细归属说明见 [NOTICE.md](NOTICE.md)，完整许可条款见 [LICENSE](LICENSE)。

---

## English

HRouter Desktop is an independent distribution based on [CC Switch](https://github.com/farion1231/cc-switch). The current source adds an account-free provider workbench, read-only CC Switch provider import, opt-in diagnostic requests, configuration protection for Claude Code and Codex, failover controls, and local/server billing comparison. HRouter remains an optional integration. The workbench is included from v0.3.0.

The source also includes Lite mode, provider-only sync, per-model failover routes, explicit Windows/WSL configuration targets, and usage-accounting corrections. See the [issue remediation and acceptance checklist](docs/issue-remediation.md) for verified behavior and remaining real-client validation; compatibility options are not a guarantee for every provider or historical session.

Install the app, create a key in HRouter, select an agent, and choose “Add HRouter.” Enter the key, discover the available models, review the mappings, then save and enable the configuration. See the sections above for development commands.

For signing controls and data handling, see the [code signing policy](CODE_SIGNING_POLICY.md) and [privacy policy](PRIVACY.md).

## 作者与服务 · Author & services

由 [honestTai](https://github.com/honestTai) 维护，配合 [HRouter](https://hrouter.net/home) 使用。项目反馈欢迎提交到 Issues，使用帮助与模型服务请访问 HRouter。  
Maintained by honestTai for HRouter users. Share app feedback in Issues; visit HRouter for model access and service help.

[HRouter](https://hrouter.net/home) · [问题反馈 / Issues](https://github.com/honestTai/HRouter-Desktop/issues) · [更多项目 / More projects](https://github.com/honestTai)
