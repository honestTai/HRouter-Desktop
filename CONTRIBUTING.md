# Contributing / 贡献指南

感谢参与 HRouter Desktop。提交代码前请阅读 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) 和 [SECURITY.md](SECURITY.md)。

## 开发环境

- Node.js 20 与 pnpm 10
- Rust 1.85+
- 当前系统对应的 [Tauri 2 开发依赖](https://v2.tauri.app/start/prerequisites/)

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

提交前运行：

```bash
pnpm typecheck
pnpm format:check
pnpm test:unit
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## 提交流程

1. 新功能先开 Issue 讨论。
2. 从 `main` 创建聚焦的功能或修复分支。
3. 不要提交真实 HRouter Key、OAuth Token、用户配置、日志或构建产物。
4. 用户可见文案需要同步更新 `src/locales` 下的语言文件。
5. Pull Request 说明改动目的、用户影响和验证结果。

本项目保留从 CC Switch 继承的历史和许可证。涉及上游代码时，请避免删除原始版权信息。
