# CC Switch 上游贡献记录

更新日期：2026-09-27。

## 已提交

- 草稿 PR：[farion1231/cc-switch#7710](https://github.com/farion1231/cc-switch/pull/7710)
- 标题：`fix(opencode): prevent pruned usage from being counted again`
- 关联问题：[#7674](https://github.com/farion1231/cc-switch/issues/7674)
- 来源分支：`honestTai/cc-switch:codex/fix-opencode-usage-replay`
- 目标分支：`farion1231/cc-switch:main`
- 上游基线：`1ee2fdc3a791f1e73476c631c7ab7ce8fac0638f`
- 提交：`f9b99c42f72aa147884605deaab2e1ce5c88078a`
- 上游贡献在独立 Git 工作区完成，与 HRouter 发布分支分开。

补丁只涉及 `session_usage_opencode.rs` 与 `database/dao/usage_rollup.rs`：未完成消息不再阻止已处理会话推进游标；复用上游现有 `session_usage_dedup` 表保存被清理的 OpenCode 消息 ID，防止更新会话或丢失游标后重复汇总。未带入 HRouter 品牌、登录、账单或推广入口。

此 PR 阻止后续重复累计，不重建已经膨胀的历史汇总。清理发生在补丁之前且没有留下明细的消息，无法从汇总数据恢复其 ID。Linux/NFS 原报告环境尚未实测，所以保留草稿状态。

## 验证

- 三组新增回归测试在原实现下全部失败，修复后全部通过；OpenCode 模块共 9 项通过。
- 前端 141 个文件、1173 项测试通过，完整重跑使用 `--maxWorkers=2 --minWorkers=1`。首次默认并发运行有 App 集成测试超时及其后续清理失败，单独重跑和限制并发后的全量均通过。
- 类型检查、前端格式检查、生产构建、Rust 格式检查、`cargo clippy -- -D warnings` 均通过。
- 当前 Windows 缺少创建符号链接权限，三项既有测试报 1314。跳过这三项后，Rust 单元与集成测试共 3051 项通过、10 项原有忽略、3 项过滤。PR 中已披露，未修改测试来掩盖失败。
- 使用隔离测试目录和临时 SQLite 数据库，未修改真实用户用量。
- Git HTTPS 推送失败后，使用 GitHub Git Data API 上传；远端 tree 与 commit SHA 均与本地一致。
- 提交时仅自动标签检查完成；尚未获得上游测试 CI 或维护者批准。草稿 PR 不等于合并。

## 本次未重复提交

| 候选修复 | 搜索结果 | 处理 |
| --- | --- | --- |
| Codex 子会话在父会话空闲后漏统计 | 已有待审 [PR #7297](https://github.com/farion1231/cc-switch/pull/7297)，关联较早的 #5687 | 不另建重复 PR |
| Claude 1 小时缓存计价 | 已有待审 [PR #7653](https://github.com/farion1231/cc-switch/pull/7653)，关联 #7652 | 不另建重复 PR |
| 托盘切换与自动故障转移 | 曾有已关闭 [PR #6164](https://github.com/farion1231/cc-switch/pull/6164) | 后续需核对关闭原因及手动首选的设计，再决定提交范围 |

Lite、模型路由、多环境与会话兼容等功能尚未向上游提交；需要分别讨论设计、移除 HRouter 依赖、补齐四语言文案，并在对应真实环境验收。

HRouter 原工作区仍保留先前未提交修改，上游提交在独立工作区完成。
