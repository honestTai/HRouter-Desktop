# Claude Desktop 本地会话读取

会话管理中的 **Claude Desktop** 来源支持 Code、Cowork 和本地 Chat 会话，与 Claude Code CLI 分开筛选、搜索和展示。

## 数据源

- macOS：`~/Library/Application Support/Claude`、`Claude-3p` 和 `Claude-...` / `Claude ...` 命名的客户端配置目录。
- Windows：`%APPDATA%`、`%LOCALAPPDATA%` 下的同类目录，以及 Claude MSIX 包的 `LocalCache/Roaming` / `LocalCache/Local` 目录。
- 每个客户端目录内扫描 `claude-code-sessions` 和 `local-agent-mode-sessions`，兼容账号/组织的完整 UUID 和缩短目录名。
- 读取 `local_*.json` 会话元数据，再关联会话目录中的 `.claude/projects/<project>/<cliSessionId>.jsonl`。会话目录兼容 `local_<uuid>`、`<uuid>` 和 8 位短名称。
- Code 会话也可以关联 Claude Code 的共享日志。设置了 CLI 自定义配置目录时，仍会检查默认 `~/.claude/projects` 中的 Desktop 日志。
- 共享日志中的 `entrypoint: claude-desktop` / `claude-desktop-3p` 可直接识别为 Desktop 来源，即使没有桌面元数据。

## macOS / Windows 兼容

| 平台 | 目录探测 |
| --- | --- |
| macOS | 用户主目录下的 `Library/Application Support/Claude`、`Claude-3p` 和命名配置目录 |
| Windows 普通安装 | 优先使用 `%APPDATA%`、`%LOCALAPPDATA%`；环境变量缺失、为空或为相对路径时，回退到用户主目录下的 `AppData/Roaming`、`AppData/Local` |
| Windows 商店安装 | `%LOCALAPPDATA%/Packages/Claude_*/LocalCache/{Roaming,Local}` 和 `AnthropicPBC.Claude_*` 同类目录中的 Claude 配置目录 |

Windows 配置目录名按 ASCII 大小写不敏感匹配。目录由原生 `PathBuf` 拼接，正文路径原样通过 JSON 传递；不手动替换盘符、反斜杠或 UNC 前缀。读取兼容中文、空格路径及 CRLF 日志。相同目录通过环境变量、规范化路径等方式重复发现时会去重。

macOS 和 Windows 的目录探测函数均可独立测试，不依赖修改测试进程的环境变量。跨平台布局测试覆盖普通安装、重定向的 AppData、两种商店包、短目录名以及缺失目录；前端测试覆盖 POSIX、Windows 盘符、UNC 和扩展长度路径的文件名显示。

仓库现有 CI 在 `macos-latest`、`windows-latest` 和 Linux 上运行 Rust 测试。额外的 `windows_native_verbatim_and_case_aliases_deduplicate` 只在 Windows 上验证真实文件系统的大小写和扩展长度路径别名；在 macOS 上通过布局测试不等同于完成 Windows 原生验证。

## 展示与容错

- 优先使用桌面元数据的标题、创建时间、活动时间；项目目录优先显示用户选择的宿主机文件夹，而非 VM 工作目录。
- 同一正文文件被 CLI / 多个桌面配置引用时，仅展示一条 Desktop 记录。
- 正文缺失时回退到同会话 `audit.jsonl`；正文和审计日志都缺失时，仍可展示元数据及初始消息。后者不代表完整历史已同步，刷新后会重新发现正文。
- 元数据损坏或丢失时，仍能发现保留下来的独立正文。
- 支持文本和工具调用/结果；忽略子代理日志，避免重复显示独立会话。
- 跳过损坏、过大的元数据和越界路径。目录扫描有固定层级，不递归索引插件、挂载项目、Electron 缓存或凭据。

## 安全边界

Desktop 会话为**只读**：允许查看、搜索和复制，不在 HRouter 中删除，也不生成不可靠的 CLI 恢复命令。前端禁用破坏性操作，后端同时拒绝 Desktop 删除请求。请在 Claude Desktop 中继续或删除这些会话，以保留其索引、VM 和归档状态。

普通 Claude 云端聊天，以及尚未落到本机的远程会话正文，不在本地扫描器的覆盖范围；不会读取登录凭据或调用云端接口来冒充已同步的完整历史。

## 验证

```sh
cargo test --manifest-path src-tauri/Cargo.toml --lib session_manager::
pnpm test:unit tests/components/SessionManagerPage.test.tsx tests/components/sessionUtils.test.ts tests/config/cliAgentInventory.test.ts
pnpm typecheck
```

另有显式启用的本机只读 smoke test。它要求电脑上存在 Claude Desktop 本地历史，只输出会话/消息数量，不打印标题、路径、账号或正文：

```sh
cargo test --manifest-path src-tauri/Cargo.toml --lib session_manager::providers::claude_desktop::tests::local_desktop_read_only_smoke -- --ignored --exact --nocapture
```
