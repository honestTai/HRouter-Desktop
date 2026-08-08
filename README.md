<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="HRouter Desktop" width="96" />
  <h1>HRouter Desktop</h1>
  <p>一个 Key，为常用 AI Agent 自动导入模型、配置路由并查看用量。</p>

  [HRouter 官网](https://www.honesttai.com) · [下载与版本发布](https://github.com/honestTai/HRouter-Desktop/releases) · [问题反馈](https://github.com/honestTai/HRouter-Desktop/issues)
</div>

> HRouter Desktop 基于开源项目 [CC Switch](https://github.com/farion1231/cc-switch)（MIT License）定制开发。本项目保留原始版权和许可证声明，不是 CC Switch 官方发行版，也不代表原项目维护者背书。

## 功能

- 每个 Agent 只展示 HRouter 供应商，输入 HRouter Key 即可开始配置。
- 同一个 Agent 可以保存多个 HRouter Key 配置并快速切换。
- 使用当前 Key 实时获取可用模型。
- 自动预填默认模型和模型映射，保存前仍可手动调整。
- 支持 Claude Code、Claude Desktop、Codex、Gemini CLI、Grok Build、OpenCode、OpenClaw 和 Hermes。
- 自动查询近 30 天用量：订阅 Key 显示总额度、已用和剩余；按量 Key 显示消费与余额。
- 提供按模型统计的请求量、Token 和费用信息。

## 快速开始

1. 前往 [HRouter](https://www.honesttai.com) 注册或登录。
2. 在控制台创建 API Key。
3. 从 [Releases](https://github.com/honestTai/HRouter-Desktop/releases) 下载适合系统的安装包。
4. 打开 HRouter Desktop，选择 Agent，点击“添加 HRouter”。
5. 输入 Key 并点击“识别 Key”。
6. 确认模型绑定后保存并启用配置。

安装包尚未发布时，可以按照下面的开发说明从源码运行。

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

## 隐私与安全

- 本仓库只包含桌面客户端源码，不包含 HRouter 后台、服务端、渠道配置或运维脚本。
- 用户 Key 是运行时配置，不应提交到 Git 仓库、Issue、日志或截图中。
- 报告安全问题时请使用 [GitHub Security Advisories](https://github.com/honestTai/HRouter-Desktop/security/advisories/new)，不要公开提交包含凭据的 Issue。

## 与 CC Switch 上游的关系

- 上游仓库：<https://github.com/farion1231/cc-switch>
- 上游许可证：MIT
- HRouter 会按需参考上游更新，不保证与 CC Switch 功能或发布节奏一致。
- 代码中保留的部分 `cc-switch` 内部标识用于兼容配置、迁移和历史数据，不代表产品品牌。

详细归属说明见 [NOTICE.md](NOTICE.md)，完整许可条款见 [LICENSE](LICENSE)。

---

## English

HRouter Desktop is an independent HRouter-focused distribution based on [CC Switch](https://github.com/farion1231/cc-switch). It lets users configure supported AI agents with an HRouter Key, fetch available models, manage model mappings, and inspect subscription or pay-as-you-go usage. See the Chinese sections above for setup and development commands.

This repository contains only the desktop client. It does not contain HRouter server, operations, channel, or administrator code.
