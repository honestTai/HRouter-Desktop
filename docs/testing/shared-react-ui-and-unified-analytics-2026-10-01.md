# 共享 React UI、完整 Agent 清单与统一用量统计

日期：2026-10-01

## 本轮行为

- 导航只保留「用量统计」，旧的 `dashboard` 页面状态迁移至 `usage`。
- 本地页面合并概览、趋势、请求日志、供应商与模型统计；HRouter 云端页面合并概览与请求明细。两种来源不相加。本地不要求登录，云端继续受已配置 HRouter Key 和账号登录控制。
- 会话筛选、Skills/MCP 管理、方案与线路选择、用量筛选显示完整 11 个 Agent 清单。显示和支持能力分开：未实现的写入/统计能力标注「暂未适配」并禁用；会话筛选可选择未适配项查看原因。
- 配置中心切换器保留全部已设为可见的 Agent，可横向滚动，不再放进额外折叠菜单。
- 提示词管理入口、路由及方案中的提示词捕获/应用逻辑移除。保留历史数据结构与用户已有文件，旧方案不再通过此功能写入提示词。

## 控件与布局

- 扫描 renderer 的全部 TSX 业务组件，将零散按钮、输入、复选框、文本域、表格和折叠控件统一到共享 React/Radix primitives。
- Skills 导入改用共享 Dialog；MCP 协议选择改用 Tabs；日期/时间改为 React Popover 日历与校验输入，不使用系统日期选择器。
- 修正按钮内嵌 Switch、按钮内嵌按钮等交互层级。
- Skills/MCP 共用 Agent 清单卡片，Settings 共用卡片、Select、Switch、Tabs；统一宽度、内边距和滚动布局。
- 设置读取失败显示错误与重试，不再留下空白标签页。
- `SharedUiAudit.test.ts` 用 TypeScript AST 审计全部业务 TSX：原生交互控件只能存在于 `components/ui` 基础封装层，隐藏序列化 input 除外。原生日期/时间/复选框也不能绕过 `Input` 封装重新引入。

## 自动验证

- `pnpm typecheck`：通过。
- `pnpm test:unit`：134 个文件，865 项测试通过。
- `pnpm build:renderer`：通过；仍有现有的 bundle 大小警告。
- `cargo test --manifest-path src-tauri/Cargo.toml --lib services::profile::tests`：10 项通过，包括历史 prompt-only 方案不再被视为有效快照且历史引用不丢失。
- `git diff --check`：通过。

## UI 验证与边界

- 浏览器预览：宽屏与 900×800 下检查 Skills、MCP、设置布局；会话菜单验证 11 个 Agent 及未适配项说明；更多菜单只剩会话、MCP、Skills，导航只有一个用量入口。
- 浏览器没有 Tauri IPC，设置完整布局使用仅在内存中的测试数据，未保存设置；刷新清除。它不是原生后端端到端验收。
- 原生预览可读取初始辅助功能树：统一用量页面展示本地读取结果、概览、趋势与请求表。后续原生交互受 ScreenCaptureKit -3812 错误阻挡，未宣称原生全流程点击验收通过。
- 本轮没有为尚未适配的 Agent 虚构会话/用量/MCP/Skills 适配器，没有安装软件、修改生产 Key 或登录云端账号。
