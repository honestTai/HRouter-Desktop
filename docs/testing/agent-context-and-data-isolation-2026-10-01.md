# Agent context and data isolation — 2026-10-01

## Operation model

- Workbench, Providers, Profiles and Routes share the shell's current Agent. Changes in any configuration page update the same state and existing last-Agent preference. Switching the visible Agent is not itself a provider activation or native config write.
- Local usage and sessions initially use that exact Agent. Their read-only filters can inspect another Agent or All without changing the configuration target. Returning to local usage from another menu starts with the shell Agent again. Cloud account usage is account-scoped, not mislabeled as per-Agent local data.
- MCP and Skills keep a shared inventory, with an explicit target selector tied to the shell. New MCP forms select only the current supported Agent; existing MCP app enablement remains intact. Unsupported targets are not silently replaced by Claude. Skill installs/restores for an unsupported target are blocked with an explanation.
- Claude Desktop is not silently replaced by Claude Code in sessions or Skills. GUI configuration support remains; the previous CLI-only installer rule is unchanged.
- Settings and account pages do not reset the configuration Agent. Partial visibility settings treat unspecified Agents consistently as visible.

## Data-path defects corrected

1. `useProvidersQuery` no longer uses another Agent's data as a loading placeholder. A failed read is an error, not a successful empty configuration. The provider page pauses actions and offers retry on read failure.
2. Provider changes invalidate all representations of the affected Agent: provider center, workbench card, profile preview, direct routes, model routes and native live-provider caches. In-flight mutation completion retains its original scope even if the selected Agent has changed. Partial failures refresh potentially changed files rather than keeping stale state.
3. Profile apply invalidates its actual scope, not only the original Claude/Desktop/Codex list. Native switch/profile events refresh the event's Agent even when another Agent is currently selected.
4. Import, configuration restore/deployment and compatibility updates use the same invalidation helpers.
5. Usage queries no longer fold `claude-desktop` into `claude`. Summary, trends, provider/model stats and request filters use the exact persisted app_type. Cross-source duplicate detection is deliberately preserved: a desktop gateway request duplicated by its underlying Claude transcript is still counted once. The desktop coverage note still limits this to recorded proxy usage, not all proprietary chat history.
6. Database current-provider updates reject a nonempty missing/foreign provider ID and roll back the transaction, preserving the old current provider. The explicit empty-ID clear operation used by configuration rollback remains supported.

## Visual details

- Provider center Agent switcher uses a solid primary background, contrasting text, checkmark and accessible pressed state; selection is revealed in the horizontally scrollable list on selection/resize.
- Active providers have a stronger outline, subtle tinted background and ring; proxy-active providers retain their distinct green state.
- Profile selection is controlled by the shell and locked while applying a mutation. Usage filters expose their pressed state and explain their read-only scope.

## Verification

- Frontend: 138 files / 886 tests passed; TypeScript and production renderer build passed (existing bundle-size warning remains).
- Rust: provider DAO 7, usage stats 33, profile 12, configuration protection 9 tests passed. The two new isolation fixtures cover all 11 Agent IDs with identical provider IDs and both live usage rows and rollups.
- New frontend tests cover the cross-menu round trip, delayed query responses, no previous-Agent placeholders, failure states, in-flight write scope, new profile scope invalidation, All-filter isolation, explicit MCP defaults through the submitted mutation payload, and no unsupported Skill fallback.
- Browser preview checked actual React layout and menu navigation at normal and 900px widths. Temporary in-memory read mocks were used only for layout; provider reads were observed with the selected Agent parameter, and mocks were removed by reload. This is not native backend E2E evidence; backend correctness was separately tested with real isolated SQLite databases.
- Updated only the isolated `/tmp/HRouter UI Preview.app` executable after rebuilding. The production application and real Agent configuration files were not modified for verification. Native screen capture remains unavailable, so no full native UI end-to-end claim is made.
