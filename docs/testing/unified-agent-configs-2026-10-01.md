# Unified Agent file configuration — 2026-10-01

## Delivered scope (corrected after user clarification)

- All eleven agents use the existing `AgentAccessCard` grid. Pi Agent, DeepSeek Harness and WorkBuddy are frontend `AppId`s, present in the regular AppSwitcher, visibility settings and provider center.
- **No separate file-configuration workspace or lightweight guide remains.** The previous `ExtraAgentConnections` component has been removed.
- The ordinary `AddProviderDialog` / `EditProviderDialog` dispatch to a form driver using the same BasicFormFields, endpoint/key/model controls and `provider-form` submission contract. HRouter quick-connect generates compatible provider settings as well.
- The existing provider CRUD, import, sort and switch commands dispatch these three IDs to file-backed provider drivers. Providers are stored in the same SQLite `providers` table, with ordinary current-provider state, query refresh and switch events.
- First provider is applied when added; subsequent providers remain saved until enabled. Editing the current provider updates its native config; editing an inactive one does not. Current providers cannot be deleted until another is enabled.
- Pi and WorkBuddy use official SVG assets; Harness uses the existing DeepSeek brand logo. No letter placeholders.
- No new gateway/proxy or session migration. These are provider/configuration drivers, **not** additional proxy, session, MCP or Skills engines. Those unsupported capabilities are not silently mapped to Claude/Codex.

## Primary sources checked

Retrieved on 2026-10-01 (upstream schemas can change):

- Pi model schema: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/models.md
- Harness environment layering: https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/launch-environment/README.md
- Harness home resolution: https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/home-paths/src/index.ts
- Harness global patch composition: https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/src/profile-boot.ts
- Actual Cordis patch algorithm: https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/include/src/index.ts
- Harness pi-ai provider schema: https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-pi-ai/README.md
- WorkBuddy expressly supports existing `~/.codebuddy/models.json`: https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model
- Shared CodeBuddy models.json schema: https://www.workbuddy.ai/docs/ide/Features/models

The WorkBuddy guide and shared models.json schema are from the official CodeBuddy/WorkBuddy documentation build `0c7c3272facedbcbcfc0375d0a2cf1155b0c9d60` (2026-09-30). WorkBuddy runtime compatibility remains to be tested in an installed client, not inferred as a successful model call.

## Adapter behavior

### Pi

- Default `~/.pi/agent/models.json`; respects absolute `PI_CODING_AGENT_DIR` and `~/` expansion.
- Merges only `providers.hrouter`, retains other providers and unknown fields/model metadata.
- Environment reference or literal key, plus preserve-existing-key editing. Does not modify `auth.json`, session files, or default model.
- Endpoint/protocol changes affect every model in the managed provider; UI explains this. Pi login credentials can take precedence.

### DeepSeek Harness

- Default `~/.dsh/cordis.patch.yml`; respects `DSH_HOME` (rejects relative paths rather than guessing the client launch directory).
- Writes a genuine Cordis **insert patch**, not the previous standalone plugin-list snippet. Inserts `hrouter-managed-provider` using `@deepseek-ai/dsh-llm-pi-ai`, providing the `hrouter` route.
- A separate adapter avoids replacing the inherited `llm-pi-ai` plugin's whole configuration: Cordis patches replace `config`, they do not deep-merge it.
- Maintains a marked block. Text/comments/`!!js` expressions outside the block remain byte-preserved; a standalone empty `[]` initial list is commented out so a block-style list can be appended. Comments inside the managed block may be reformatted. Model metadata inside it is retained.
- Rejects invalid/multiple documents, ambiguous markers, malformed owned blocks, nonempty flow-style lists, explicit document ends, and conflicting route definitions in the same home patch.
- Home patch applies across profiles. A conflicting route in another profile or later CLI overlay is not resolved automatically; this limitation is stated in the UI. Existing user-managed profile providers are not silently adopted or modified.
- Supports environment references and direct API keys through the same provider form. Literal keys are projected into the official `$DSH_HOME/.env` launcher layer under `HROUTER_MANAGED_API_KEY`; that file is backed up and protected with 0600 permissions. Failure to update the patch restores the prior `.env` if it has not changed concurrently.
- Process and project environment values can override the home `.env`. Restart Harness and select the model; existing session selections are not silently changed.

### WorkBuddy

- Global `~/.codebuddy/models.json` (shared with CodeBuddy, not a guessed `.workbuddy` path).
- Root `models` array. Upserts by model `id`, preserving unknown fields, other models and capability metadata. Nonempty `availableModels` filters gain the selected model without removing existing entries.
- Uses literal `apiKey`, complete `url`, OpenAI Chat Completions only. Adds `/chat/completions` when absent and never duplicates it.
- Newly added entries enable tool calling; user must choose a tool-capable model. Existing capability flags are preserved.
- Project-level config may override global values. Custom-protocol endpoints and private GUI databases are not modified.

## Safety

- Ordinary provider activation automatically backs up files. The existing switch-preview API also supports these drivers, with a SHA-256 revision bound to the agent/path/source/generated contents (including Harness .env).
- Backup exact original bytes before atomic replacement, recheck source after backup, serialize HRouter writers.
- Unix mode 0600 for configuration and backup; Windows inherits directory permissions.
- Refuse symlink paths, malformed structures, duplicate WorkBuddy model IDs, and files over 2 MiB.
- `CC_SWITCH_TEST_HOME` ignores real-home overrides; all acceptance writes use an isolated directory.
- Revision checks reduce lost updates but are not a cross-process lock on third-party clients. Avoid editing the same file concurrently in those clients.

## Verification

- TypeScript typecheck passed.
- Full frontend suite: 127 files / 828 tests passed.
- New Rust adapter suite: 8 tests passed (all three adapters, backup/roundtrip/redaction, stale previews, credential boundaries, YAML preservation/empty-list conversion, metadata/filter preservation, symlink/size limits).
- Existing Pi writer suite: 7 tests passed.
- Renderer production build passed; existing large-bundle warning remains.
- Provider-service Rust suite: 4 tests passed, covering all three ordinary create/list/edit/switch/delete lifecycles, failed-live-write DB rollback, `.env` preservation and stale-revision refusal.
- Native acceptance in `com.hrouter.uiacceptance` / `/tmp/hrouter-ui-acceptance-home`: selected each of the three cards, opened the **same Add Provider panel**, entered fake local credentials and model IDs, and saved successfully. All three appeared as current providers in the standard SQLite table and workstation cards. WorkBuddy was also opened in the common provider center; the normal Copy and Enable actions were executed, the selected provider changed, and the standard completion notification appeared.
- Native output files were inspected separately: Pi model/key, WorkBuddy preserved original model plus new model, Harness patch plus .env credential, and mode 0600 all verified. Existing model metadata and exact-byte backups were checked in isolated tests.
- Earlier native-generated Harness patch was passed through the **actual upstream `applyEntryPatches` implementation** (TypeScript transpiled locally), confirming the inserted adapter is applied and the original provider adapter configuration remains intact.

No installed third-party Pi/Harness/WorkBuddy client or real service key is used in these tests. Configuration acceptance is distinct from a verified upstream model request.
