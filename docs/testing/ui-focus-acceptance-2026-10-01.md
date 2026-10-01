# 接入工作台改版验收 — 2026-10-01

## 交付边界

- 保持 HRouter 为客户端配置与中转服务接入工具；没有新增 Gateway 或协议转换架构。
- 工作台展示真实 Agent 配置状态；配置中心支持供应商搜索、卡片操作及网格拖拽。
- 接入方案仅支持 Claude Code、Claude Desktop、Codex，保存供应商引用及支持的 MCP / Skills / 提示词选择，不保存密钥副本或会话备份。
- 方案应用不是原子事务：会保存原方案、关闭目标 Agent 的接管、更新配置；部分失败须检查警告。
- 线路策略复用原有代理，支持 Claude Code、Codex、Gemini CLI、Grok Build。默认直连，可以在未开启接管时编辑队列；自动切换必须先有运行中的接管。
- 不宣称会话粘性、跨模型上下文兼容或没有请求记录时的健康状态。

## 自动化验证

| 检查                     | 结果                           |
| ------------------------ | ------------------------------ |
| `pnpm typecheck`         | 通过                           |
| `pnpm test:unit`         | 125 个测试文件、808 条测试通过 |
| `pnpm build:renderer`    | 通过；仍有现有 bundle 大小警告 |
| Rust `profile_roundtrip` | 7 条通过                       |
| Rust `provider_service`  | 36 条通过                      |

新增前端测试覆盖：方案创建/搜索/重命名、删除确认与取消、删除失败、按 Agent 更新快照、应用预览与部分成功警告、读取失败、接管确认、离线队列配置和自动切换门控、Agent 切换一致性、不支持的路由类型、原生接口失败、Agent 状态卡片和模型摘要解析。

Rust 集成测试使用隔离文件系统和 SQLite，覆盖方案读写/范围隔离/缺失引用/接管关闭/原方案保存，以及托管 Codex 供应商切换时的会话文件和数据库保护。两个测试二进制顺序运行，避免共享测试目录相互覆盖：

```sh
cargo test --manifest-path src-tauri/Cargo.toml --test profile_roundtrip --no-default-features -- --test-threads=1
cargo test --manifest-path src-tauri/Cargo.toml --test provider_service --no-default-features -- --test-threads=1
```

## 原生 Tauri 实际验收（不是浏览器 mock）

使用独立应用标识 `com.hrouter.uiacceptance` 和 `CC_SWITCH_TEST_HOME=/tmp/hrouter-ui-acceptance-home`，不使用用户生产 API Key，也不写用户日常 Codex/Claude 配置目录。

1. 启动原生预览，工作台选择 Codex，进入配置中心；选中的 Agent 保持一致。
2. 在原生 UI 启用官方预设，创建 `Codex acceptance` 方案，打开变更预览并实际应用。SQLite 持久化成功，页面出现最近应用标记。
3. 在隔离数据库准备两个本地测试供应商及会话 JSONL；通过原生 UI 依次切换。会话文件仍保留，当前配置使用稳定 provider id。
4. 原生 UI 开启 Codex 接管，本地代理监听 `127.0.0.1:19571`；测试上游监听 `127.0.0.1:19572`。实际 POST `/v1/responses` 返回 HTTP 200 和 `local acceptance ok`。
5. 在原生 UI 添加两条队列记录并开启自动故障转移。P1 的 `/fail/v1/responses` 故意返回 HTTP 503，代理随后请求 P2 的 `/v1/responses`，最终返回 HTTP 200。上游访问记录和 Rust 日志都确认先失败再切换，UI 的全局切换次数变为 1。
6. 在原生 UI 关闭自动故障转移及接管；确认服务已停止，客户端 Base URL 恢复为测试供应商地址而不是代理端口。
7. 检查浅色线路页、深色工作台、设置工具入口。缩窄布局下导航没有隐藏“更多”，工作台及线路页去掉重复标题栏。

实际转发测试只连接 loopback 模拟上游，不代表已经验证所有生产供应商、真实计费、流式工具调用或每个版本的 Codex 客户端。浏览器单独打开开发服务器仅可用于界面预览，原生功能需要 Tauri bridge。

## 本机预览

- UI 开发服务：`127.0.0.1:3000`
- 已启动隔离原生预览：`/tmp/HRouter UI Preview.app`
- 测试数据仅在临时目录，应用未替换 `/Applications/HRouter.app`。
- 生产发布仍按仓库正常打包/签名流程执行；本次没有生成或发布签名安装包。
