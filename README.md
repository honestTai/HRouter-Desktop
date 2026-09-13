<div align="center">

# HRouter Desktop

<img src="src-tauri/icons/128x128.png" width="96" alt="HRouter Desktop">

**一个 Key，配置你的 AI 编程工具。**  
**One key. Your AI coding tools, configured.**

[Windows 下载](https://github.com/honestTai/HRouter-Desktop/releases/download/v0.2.15/HRouter_0.2.15_x64-setup.exe) · [macOS 下载](https://github.com/honestTai/HRouter-Desktop/releases/download/v0.2.15/HRouter_0.2.15_universal.dmg) · [所有版本 / Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest) · [HRouter](https://hrouter.net/home)

</div>

把模型识别、路由配置和用量查询放进一个桌面客户端，减少在不同工具的配置文件之间来回切换。

Discover models, configure routing, and track usage in one desktop app instead of juggling configuration files.

**适合谁 / Who it’s for**  
同时使用多个 AI 编程工具，希望集中配置模型与查看用量的开发者。  
Developers who use multiple AI coding tools and want a central place for model configuration and usage.

> Based on [CC Switch](https://github.com/farion1231/cc-switch), licensed under MIT. 原作者版权与许可证声明保留。

## 下载与接入 · Download & connect

截至 **2026-09-13** 核验，正式版本为 **v0.2.15**。版本更新后，以 [Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest) 为准。

| 平台 / Platform | 安装包 / Installer |
| --- | --- |
| Windows x64 | [下载 EXE / Download EXE](https://github.com/honestTai/HRouter-Desktop/releases/download/v0.2.15/HRouter_0.2.15_x64-setup.exe) |
| macOS Universal | [下载 DMG / Download DMG](https://github.com/honestTai/HRouter-Desktop/releases/download/v0.2.15/HRouter_0.2.15_universal.dmg) |

**安装客户端 → 创建 HRouter Key → 选择 Agent → 识别模型并保存配置 → 查看用量。**  
**Install → create a HRouter key → choose an agent → discover models and save → review usage.**

## 功能

- 每个 Agent 只展示 HRouter 供应商，输入 HRouter Key 即可开始配置。
- 同一个 Agent 可以保存多个 HRouter Key 配置并快速切换。
- 使用当前 Key 实时获取可用模型。
- 自动预填默认模型和模型映射，保存前仍可手动调整。
- 支持 Claude Code、Claude Desktop、Codex、Gemini CLI、Grok Build、OpenCode、OpenClaw 和 Hermes。
- 自动查询近 30 天用量：订阅 Key 显示总额度、已用和剩余；按量 Key 显示消费与余额。
- 提供按模型统计的请求量、Token 和费用信息。

## 快速开始

1. 前往 [HRouter](https://hrouter.net/) 注册或登录。
2. 在控制台创建 API Key。
3. 在上方选择 Windows x64 或 macOS Universal 安装包，安装并打开客户端。
4. 打开 HRouter Desktop，选择 Agent，点击“添加 HRouter”。
5. 输入 Key 并点击“识别 Key”。
6. 确认模型绑定后保存并启用配置。

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

HRouter Desktop is an independent HRouter-focused distribution based on [CC Switch](https://github.com/farion1231/cc-switch). It lets users configure supported AI agents with a HRouter key, fetch available models, manage model mappings, and inspect subscription or pay-as-you-go usage. Windows x64 and macOS Universal installers are available from [GitHub Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest).

Install the app, create a key in HRouter, select an agent, and choose “Add HRouter.” Enter the key, discover the available models, review the mappings, then save and enable the configuration. See the sections above for development commands.

For signing controls and data handling, see the [code signing policy](CODE_SIGNING_POLICY.md) and [privacy policy](PRIVACY.md).

## 作者与服务 · Author & services

由 [honestTai](https://github.com/honestTai) 维护，配合 [HRouter](https://hrouter.net/home) 使用。项目反馈欢迎提交到 Issues，使用帮助与模型服务请访问 HRouter。  
Maintained by honestTai for HRouter users. Share app feedback in Issues; visit HRouter for model access and service help.

[HRouter](https://hrouter.net/home) · [问题反馈 / Issues](https://github.com/honestTai/HRouter-Desktop/issues) · [更多项目 / More projects](https://github.com/honestTai)
