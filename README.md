<div align="center">

# HRouter Desktop

<img src="src-tauri/icons/128x128.png" width="96" alt="HRouter Desktop">

**一个 Key，配置你的 AI 编程工具。**  
**One key. Your AI coding tools, configured.**

[下载客户端 / Downloads](https://github.com/honestTai/HRouter-Desktop/releases) · [GitHub](https://github.com/honestTai/HRouter-Desktop) · [HRouter](https://hrouter.net/home)

</div>

把模型识别、路由配置和用量查询放进一个桌面客户端，减少在不同工具的配置文件之间来回切换。

Discover models, configure routing, and track usage in one desktop app instead of juggling configuration files.

**适合谁 / Who it’s for**  
同时使用多个 AI 编程工具，希望集中配置模型与查看用量的开发者。  
Developers who use multiple AI coding tools and want a central place for model configuration and usage.

> Based on [CC Switch](https://github.com/farion1231/cc-switch), licensed under MIT. 原作者版权与许可证声明保留。

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
3. 从 [GitHub Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest) 下载 Windows 安装包。
4. 打开 HRouter Desktop，选择 Agent，点击“添加 HRouter”。
5. 输入 Key 并点击“识别 Key”。
6. 确认模型绑定后保存并启用配置。

> GitHub Releases 提供预编译的 Windows x64 安装包；开发者也可以按照下面的说明从源码运行。

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

HRouter Desktop is an independent HRouter-focused distribution based on [CC Switch](https://github.com/farion1231/cc-switch). It lets users configure supported AI agents with an HRouter Key, fetch available models, manage model mappings, and inspect subscription or pay-as-you-go usage. Download the Windows x64 installer from [GitHub Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest). See the Chinese sections above for setup and development commands.

For signing controls and data handling, see the [code signing policy](CODE_SIGNING_POLICY.md) and [privacy policy](PRIVACY.md).

## 作者与 HRouter · About the author

我是 **honestTai**，开发工具，也运营 [HRouter](https://hrouter.net/home)。这里持续分享实用代码、AI 应用、Skills 与插件，把工作中的需求变成可复用的项目。  
I’m **honestTai**, the developer and operator behind HRouter. I share practical code, AI apps, skills, and plugins built around real workflows.

在客户端使用 HRouter Key，即可识别可用模型、配置工具并查看用量。  
Use your HRouter key in the desktop app to discover available models, configure tools, and view usage.

[了解 HRouter · Explore HRouter](https://hrouter.net/home) · [发现更多项目 · More projects](https://github.com/honestTai)

**觉得有用，欢迎 Star；有想法，欢迎到 Issues 交流。**  
**Star the project if it helps, and share your ideas in Issues.**
