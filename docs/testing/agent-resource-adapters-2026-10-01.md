# Agent resource adapters — 2026-10-01

## Request and scope

Remove redundant “本机数据 / 无需登录” narration without removing usage collection or changing HRouter authentication rules. Implement actual Agent resource adapters rather than merely enabling unsupported UI switches. The GUI exclusion remains limited to the installation/update inventory.

This change extends the earlier shared-Agent/data-isolation work. It does **not** establish complete feature parity across every upstream client/version; the remaining boundaries below are intentional and must not be advertised as implemented.

## Implemented paths

| Area | Implemented behavior | Boundary |
| --- | --- | --- |
| MCP | Unified inventory and persisted enablement for all 11 Agent IDs. Added native adapters for Claude Desktop, OpenClaw, Pi, DeepSeek Harness, and CodeBuddy-compatible WorkBuddy configuration. | Desktop file configuration supports stdio, not account-managed remote connectors. Pi/Harness adapters reject legacy SSE instead of writing unusable configuration. |
| Skills | 10 filesystem destinations, including OpenClaw, Pi, Harness and CodeBuddy-compatible WorkBuddy. Enable/disable/import/update/restore and provider reprojection use the same target registry. | Claude Desktop uses portable ZIP export and manual account import, not an invented filesystem enablement flag. |
| Profiles | New targets capture and restore actual MCP/Skills enablement together with provider state. Integration tests cover native files and persisted flags. | Desktop account-uploaded Skills cannot be captured/restored automatically. No prompt file management was reintroduced. |
| Sessions | Added bounded readers for Pi JSONL, CodeBuddy-compatible JSONL, and Harness persisted session generations. Pi follows the active parent chain; Harness chooses the latest generation. | Harness browsing is read-only; no invented resume flag or unsafe deletion. Desktop proprietary transcripts are not read. WorkBuddy GUI/private formats are not assumed compatible. |
| Usage | Retained actual collection and exact Agent attribution/filtering. Shared session-root/record-reader logic prevents the added history readers from using different locations from usage importers. | Readable/recorded data only; selecting an Agent is not evidence of complete upstream history coverage. |
| UI | Removed single-source explanatory tabs/cards and repeated no-login/local-data messages. Automatic usage refresh is silent on success; explicit refresh still reports results. | Errors, provenance, destructive-operation confirmations and cloud authentication requirements remain. |

### File mappings

- Pi: configured Pi root, `mcp.json` and `skills` (normally `~/.pi/agent/`).
- OpenClaw: `mcp.servers` in native JSON5 config, plus its configured Skills directory. Uses the existing lossless/CAS-backed native writer.
- Harness: `cordis.patch.yml` managed MCP entries for `@deepseek-ai/dsh-mcp-client`; Skills under its configured home. Preserves content outside the HRouter block, including YAML tags/comments. Rejects conflicting entries and unsupported patch shapes.
- CodeBuddy-compatible WorkBuddy: existing `~/.codebuddy/.mcp.json`, `~/.codebuddy/mcp.json`, or `~/.codebuddy.json` in that order; default first. Skills under `~/.codebuddy/skills`.
- Claude Desktop: actual platform config selected according to deployment mode. No Linux Desktop config directory is fabricated.

### Data safety

- Database schema 17 adds resource flags with false defaults, preserves existing rows, and handles old databases missing resource tables. Repeated migration is idempotent.
- New MCP adapters preflight configuration before materializing an upsert. Failed writes do not report successful enablement. Global projection does not delete an unmanaged same-name entry in a newly introduced target merely because its default flag is false.
- Native MCP files are bounded, symlink-checked and backed up; regular file writes are atomic and detect concurrent changes. Multi-destination updates are **not** a globally atomic filesystem transaction.
- Skill ZIP export is bounded by entry count, depth and uncompressed size; it rejects symlinks and unsafe portable paths, preserves nested assets and executable bits, and cannot overwrite the source tree. Export does not enable a different Agent.
- Read-only sessions cannot enter single or batch deletion paths. Session operations validate identities and configured roots.

## Verification

- TypeScript: passed.
- Frontend: **138 test files / 900 tests passed**.
- Rust library suite: **2,438 passed, 5 ignored, 0 failed**.
- Integration suites: `mcp_commands` **23**, `skill_sync` **7**, `profile_roundtrip` **8**, `resource_adapters` **3** passed.
- Production renderer build and debug native executable build passed. Renderer retains the pre-existing large-chunk warning.
- Isolated preview executable updated in `/tmp/HRouter UI Preview.app`, with `CC_SWITCH_TEST_HOME=/tmp/hrouter-ui-acceptance-home`. Production application and real Agent configuration were not used as test fixtures.
- These are schema/native-file/SQLite/component tests, not a claim that every real CLI version was installed and exercised. No MCP subprocesses or Agent installers were executed for verification.

New regressions cover all 11 MCP form target defaults; actual config projection and selective disablement; malformed-config preflight; preservation of unmanaged MCP entries; schema migration; expanded profile restoration; ZIP export/cancellation; and exclusion of read-only sessions from deletion.

## Remaining work — do not label complete

1. Automatic proxy failover remains limited to its existing Claude Code/Codex/Gemini/Grok Build engines. Other Agents' native/direct route settings are not equivalent to automatic failover.
2. Claude Desktop account Skills require client import after ZIP export; automatic account upload and profile restoration are absent.
3. Claude Desktop session history is not integrated.
4. Harness session resume/delete are not integrated; browsing is deliberately read-only.
5. WorkBuddy adapters cover CodeBuddy-compatible configuration and logs, not unverified proprietary GUI storage.
6. All-Agent real-client runtime acceptance across platforms and historical versions remains outstanding.

## Upstream schemas consulted

Reviewed documentation/source as of 2026-10-01. Moving upstream branches are references, not pinned runtime compatibility guarantees.

- Pi: `earendil-works/pi`, `packages/coding-agent/docs/{mcp.md,session-format.md,skills.md}`.
- OpenClaw: `openclaw/openclaw`, `docs/tools/mcp.md` and Skills documentation.
- DeepSeek Harness: `deepseek-ai/deepseek-harness`, `packages/mcp/mcp-client/README.md`, `packages/skill/skill-filesystem/README.md`, and session persistence format/types.
- CodeBuddy: official CLI MCP and Skills documentation at `www.codebuddy.ai/docs/cli/`.
- Claude: official “Use Skills in Claude” support article, including ZIP-based account import.
