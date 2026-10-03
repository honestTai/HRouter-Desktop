# Screenshot provenance / 截图说明

## English-first gallery

The English-first README uses **13 selected native macOS captures** taken on **October 3, 2026** by operating the installed `/Applications/HRouter.app`. They are actual application windows, not browser mockups or fabricated data. The source captures remain outside the repository.

The local capture build contains the simplified workbench but still has a `0.3.1` bundle version. It is not the notarized v0.4.0 release. English UI was selected for the captures; some HRouter-specific labels remain Chinese. The original Simplified Chinese language and Codex agent selection were restored afterward.

| File                        | Visible interface                               | Privacy / capture note                                                                                                    |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `workbench-en.png`          | Agent selection and connection entry points     | Local provider/model labels covered.                                                                                      |
| `configuration-en.png`      | Provider list and selected provider             | Custom provider labels covered; no key or configuration editor exposed.                                                   |
| `key-setup-en.png`          | HRouter Key quick setup                         | Empty key field. No key entered, model discovery requested, or configuration saved.                                       |
| `connection-check-en.png`   | Catalog and real-request test controls          | Local provider/model labels covered. No test was run.                                                                     |
| `protection-en.png`         | Protection and Lite controls                    | Local provider/model labels covered; settings not changed.                                                                |
| `protection-targets-en.png` | Snapshots and independent target controls       | Lower scroll position of the same page; no restore or deployment performed.                                               |
| `profiles-en.png`           | Saved access profile workflow                   | Local profile/provider labels covered; no profile applied.                                                                |
| `route-policies-en.png`     | Routing status and failover controls            | Existing state only; no proxy or route settings changed.                                                                  |
| `sessions-en.png`           | Session Manager                                 | Genuine empty Gemini filter; no conversation content or project paths exposed.                                            |
| `mcp-en.png`                | MCP management and per-agent controls           | Local server labels covered; no server toggled or installed.                                                              |
| `skills-discovery-en.png`   | Public Skills catalog                           | No Skill installed. Public catalog text is third-party content, not project instructions or endorsement.                  |
| `settings-behavior-en.png`  | Language, theme, visibility, window preferences | Lower scroll position; no OS settings changed.                                                                            |
| `usage-widget-en.png`       | Floating agent usage window                     | Genuine Hermes zero-usage state; no personal spending totals. This is not a screenshot of the native WidgetKit extension. |

### Processing and privacy

- Preserve the **entire captured window** and aspect ratio, including the macOS capture indicator. These are viewport captures; off-screen content is not claimed to be included.
- Downscale large windows to 1920 pixels wide. The smaller usage window retains its native captured size.
- Apply **opaque, flattened redactions**, not blur or reversible layers, to private configuration names and model summaries.
- Re-encode into fresh PNG files without copying source metadata. No raw images, accessibility dumps, credentials, account balances, private conversations, or user-specific filesystem paths are committed.
- Empty screens and untranslated labels are intentionally kept honest. No successful checks, requests, profiles, or usage numbers were fabricated for marketing.

The three `*-zh.png` files are retained from the earlier October 3 capture set. They were resized and had the system capture strip cropped; `workbench-zh.png` also has opaque local-label redactions. The rewritten README uses the new English-first set.

## 中文

README 精选 13 张真实 macOS 窗口截图，不再逐一展示所有子页面。保留完整窗口和宽高比；长页面使用不同滚动位置，不冒充一张图包含所有内容。英文为主，尚未翻译的 HRouter 专属文案如实保留。

私人供应商、方案、MCP 名称及模型摘要使用不透明遮盖，并重新编码为 PNG。会话页使用真实空筛选，组件使用真实零用量 Agent；没有填入真实 Key、运行计费测试、修改供应商/线路或安装资源。原始图片和辅助检查数据不进入仓库。拍摄后已恢复简体中文和 Codex 选择。
