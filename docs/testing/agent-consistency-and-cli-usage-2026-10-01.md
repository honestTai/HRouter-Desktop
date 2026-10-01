# Agent consistency and CLI-only installer — 2026-10-01

## Scope and preserved behavior

The user's GUI exclusion applies **only to Agent installation/update**. All 11 configuration Agent IDs remain, including Claude Desktop and WorkBuddy. The installer displays 10 CLI tools. CodeBuddy CLI is named explicitly, not represented as a WorkBuddy GUI installer. No real CLI installation/update was executed during these tests.

- Agent card titles, provider status and models are separate vertical rows. Selection has a ring and checkmark.
- Workbench costs are pinned to its selected Agent. Independent Agent filtering remains on the aggregate analytics page. OpenCode/Codex maintenance is scoped appropriately.
- Request rows identify their Agent, including the All view. Native imports do not show invented HTTP status or latency.
- Profiles support all 11 scopes, including additive managed-provider sets and file-backed providers. Scope changes do not overwrite other Agents; legacy prompts are inert. Unmanaged additive providers are preserved.
- Routes expose every Agent, but preserve the real capability boundary: Claude Code/Codex/Gemini/Grok Build use the existing automatic proxy failover; other Agents offer native direct-provider configuration, not automatic failover. Additive providers do not promise to change the Agent's currently selected model.
- Former More navigation is exposed as buttons, retaining HRouter connection/login gating and Agent-specific contexts.
- Existing React UI primitives are reused. Four-locale static translation-key coverage is tested; usage labels and profile warnings were corrected.

## Native usage coverage and limits

Existing Claude, Codex, Gemini, Grok Build and OpenCode readers remain. Additional read-only adapters:

| Agent | Source | Important boundary |
| --- | --- | --- |
| Pi | `.pi/agent/sessions/**/*.jsonl` | Agent/session directory environment overrides and absolute or home-relative global `settings.json` sessionDir are respected. Per-command or project-relative overrides cannot be inferred. |
| OpenClaw | Agent `sessions` JSONL beneath its native agents directory | Reads assistant usage, not transcript content into the usage database. |
| CodeBuddy/WorkBuddy-compatible records | `.codebuddy/projects/**/*.jsonl` | Only Claude-compatible assistant/usage records are parsed. This does not establish coverage of every WorkBuddy GUI version or proprietary storage format. |
| DeepSeek Harness | `session.vN.jsonl` and `.zstd` beneath the configured DSH home | Formats 2–4, newest generation per folder, seeded history excluded, same-attempt samples replaced, retries counted. Older/unknown versions surface an error. A custom composition-controlled persistence root outside that directory is not auto-discovered. |
| Hermes | Native `state.db`, `session_model_usage` | Current per-model ledger schema. Cumulative deltas are weighted by API call count. Dates reflect ledger last_seen, not individual historical request timestamps. Older incompatible schemas surface errors. |
| Claude Desktop | HRouter-recorded proxy usage | Does not claim to read proprietary desktop history. |

No source history is rebuilt/deleted by incremental import. Native file source schemas can evolve; fixture validation is not an end-to-end test of installed upstream clients.

### Import safeguards

- Source databases opened read-only; transcript data/credentials never persisted in usage rows.
- Bounded recursive scans, file/row/decompressed-size limits, symlink rejection, incomplete trailing JSONL writes deferred.
- Stable source keys and durable checkpoints survive detail pruning/rollup. Counter decreases are surfaced, not silently subtracted.
- Existing proxy fingerprint dedup applied before import. No-price models are unpriced rather than assigned invented costs.
- `request_count` weights aggregate ledgers in summary/trend/provider/model/rollup totals. Pagination still counts displayed records.

## Primary schema references inspected

- Pi: `https://github.com/earendil-works/pi/tree/main/packages/coding-agent`, `docs/session-format.md`, `docs/sessions.md`, `src/core/session-manager.ts`.
- Harness: `https://github.com/deepseek-ai/deepseek-harness/tree/master`, `packages/core/session/src/types.ts`, `packages/session/session-persistence-jsonl/src/format.ts`, `packages/llm/token-meter/src/usage-projection.ts`.
- Hermes: `https://github.com/NousResearch/hermes-agent`, `hermes_state_schema.py`, `hermes_state_usage.py`, `agent/turn_usage.py`.
- CodeBuddy CLI installation: `https://www.codebuddy.ai/docs/cli/installation`.

## Verification

- Frontend: 136 test files / 872 tests passed; TypeScript and renderer production build passed. Build retains the existing large-chunk warning.
- Rust targeted suites: profiles 12, extra native readers 6, usage query 32, rollup 11, schema migration 4, CLI lifecycle 92. All passed; `cargo check` passed.
- Extra-reader fixtures test message dedup, compressed/torn JSONL, Harness seed/retry/model semantics, readonly Hermes ledger, cumulative increments/decreases, weighted rollup and pruning checkpoints, symlink traversal prevention.
- Browser preview: actual React card layout with temporary **in-memory** long-name fixtures; Gemini costs excludes unrelated maintenance; all profile Agents enabled; Pi route selection visibly checked and native-direct mode shown; navigation expanded. Reload removed fixtures. No real credentials or source files used.
- Rebuilt the isolated `com.hrouter.uiacceptance` binary, replaced only `/tmp/HRouter UI Preview.app`, and relaunched with its existing test-home wrapper. The production installation was untouched.
- Native preview automation was unavailable (ScreenCaptureKit capture error in this environment). No claim of completed native end-to-end verification, all-version upstream support, cross-platform CLI execution, or release deployment.
