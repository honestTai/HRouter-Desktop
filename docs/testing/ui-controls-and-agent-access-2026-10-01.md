# React 控件统一与扩展 Agent 接入（2026-10-01）

## UI 修改

沿用仓库已有 React + Radix UI + cmdk，采用 shadcn 风格的组合式组件，不并行引入另一套大型组件库。

- 用 `SearchSelect` 替换工作台的 9 处原生 select：供应商、环境目标、主备配置、额度组、账单应用及 Key 等。
- 模型 ID 的原生 datalist 也改为相同组件，保留显式输入自定义模型的能力。
- 支持搜索、选中标记、禁用项、空项、空搜索结果、方向键/回车/Escape、关闭后焦点回到触发器。
- 统一 Select、Popover、DropdownMenu、Dialog、Input、Button 的圆角、40px 主控件高度、边框、阴影、焦点和深浅色表现。
- 新增四种界面语言对应文案，不改变既有供应商协议或路由架构。

## 三个 Agent 的实际支持范围

| Agent            | 此版实现                                                                                 | 明确不包含                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Pi Agent         | 预览、指纹复核、原文件备份、合并写入全局 models.json；环境变量引用或明确选择的明文 Key   | 不自动安装 Pi，不修改 auth.json、settings.json 或会话，不切换默认模型           |
| DeepSeek Harness | 生成 `@deepseek-ai/dsh-llm-pi-ai` 插件 YAML 片段，引用 `apiKeyEnv`，明确指导合并已有插件 | 不盲写 cordis 配置，不重复安装/注册插件，不自动修改凭据或会话                   |
| WorkBuddy        | 官方设置向导，准备和复制端点与模型 ID，解释标准端点与 Custom Protocol                    | 不声称一键自动配置；不读写私有数据库或猜测旧版 models.json 格式，不采集登录信息 |

这是轻量配置入口，不是把三个客户端伪装成现有全托管 AppType。它们暂不参加 HRouter 的方案快照、故障转移、MCP/Skills 同步或会话管理。

### 官方依据（本次实读）

- Pi 模型配置：[models.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/models.md)
- Pi 目录及覆盖方式：[configuration.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/configuration.md)
  - 默认 `~/.pi/agent/models.json`，支持 `PI_CODING_AGENT_DIR`。
  - provider 使用 `baseUrl`、`api`、`apiKey`、`models`。
  - 已保存的登录凭据可能优先于 models.json 中的 apiKey；界面明确提醒。
- DeepSeek Harness：[llm-pi-ai 官方说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-pi-ai/README.zh.md)
  - 本次读取的文档 blob SHA：`5126fe25ed6fe4b431a74ddc0d21abd4a6d72861`。
  - 使用 `config.providers`、`baseURL`、`apiKeyEnv`、`api` 和 `models`，并非套用 Pi models.json。
- WorkBuddy：[官方 Model Configuration](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model)
  - 官方推荐 Settings → Model 的可视化自定义模型入口。
  - 默认处理 `/chat/completions` 路径；非标准完整 URL 可选 Custom Protocol。
  - 官方提到旧 `~/.codebuddy/models.json` 的兼容，不等于可以把猜测的 schema 写入 `~/.workbuddy`。

## 写入保护

Pi 的 preview 不创建文件。apply 使用同一请求和文件内容的 SHA-256 指纹，过期预览拒绝写入。非法 JSON、异常数据形状、符号链接、超过 2 MiB 的配置均拒绝修改。只合并 `providers.hrouter` 的服务字段和模型目录，保留其他提供方、已有模型元数据及未知字段。

原始字节在目标目录的 `hrouter-backups` 留档；临时文件同目录原子替换。macOS/Linux 配置与备份均为 0600，Windows 沿用目录权限。环境变量模式只生成引用，不修改系统环境。明文模式拒绝 Pi 的 `!command` 和 `$` 插值，避免把密钥字段当作执行表达式。

## 实测

- TypeScript 检查通过。
- 前端 127 个测试文件、820 条测试通过。
- 新增 Pi Rust 单元测试 7 条通过：保留未知字段与模型、拒绝坏 JSON、拒绝命令式密钥与异常 URL、只读预览、过期文件/表单拒绝写入、原字节备份及会话保留、符号链接拒绝。
- 前端 production build 通过（仍有原有 bundle 体积提示）。
- 原生 Tauri 预览中打开 Pi 对话框，搜索 `Responses` 并按回车，成功选择 OpenAI Responses。
- 通过原生 UI 预览后确认写入隔离的 `/tmp/hrouter-ui-acceptance-home/.pi/agent/models.json`。
- 文件验证确认：新 hrouter 模型存在、原供应商与未知字段保留、auth.json 不变、备份包含原内容、两个文件权限均为 0600。
- 原生 UI 确认 DeepSeek 片段字段正确，WorkBuddy 显示明确的官方设置步骤；复制行为由前端测试覆盖。

未安装或运行 Pi / DeepSeek Harness / WorkBuddy 客户端进行真实模型调用，也没有使用生产 API Key。配置生成、原生落盘与 HRouter UI 验收不等于三款客户端的所有版本和供应商都经过端到端验证。

## 复现

```sh
pnpm typecheck
pnpm test:unit
pnpm build:renderer
cargo test --manifest-path src-tauri/Cargo.toml --lib external_agents::tests --no-default-features
```

原生隔离预览仍为 `/tmp/HRouter UI Preview.app`；未替换正式安装的 HRouter 应用。
