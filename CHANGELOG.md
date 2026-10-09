# Changelog

## 0.4.2 — 2026-10-09

- Makes HRouter Claude Desktop client IDs, upstream IDs and display labels visible and independently editable, with mismatch warnings and an explicit same-ID repair action.
- Preserves compatible Claude model IDs instead of silently mapping newer Haiku models to Haiku 4.5 or older Opus models to Opus 5.
- Recommends the highest numeric model version available to the current key, independent of API ordering, while retaining saved manual selections until an explicit recommendation reset.
- Adds route creation/removal, duplicate and invalid-ID validation, context-flag preservation, and a warning when a saved default model is missing from the route map.
- Adds frontend and backend regression coverage for recommendations, manual editing, configuration round trips and exact-ID profile/request handling.

## 0.4.1 — 2026-10-07

- Adds an independent Agent selector to the floating usage window on macOS and Windows; switching the display does not change provider routes.
- Adds per-widget Agent configuration on macOS 14+, with isolated snapshots and background synchronization for all supported Agents; macOS 12/13 retains follow-app mode.
- Separates measured generation speed from server-window TPM, labels idle throughput explicitly, and retains the day's last timed request with its measurement time instead of dropping it after five minutes. Direct requests without timing remain unavailable, not fabricated zero.
- Adds native WidgetKit storage/configuration/expiry tests and an unsigned extension build to macOS CI.

- Adds read-only Claude Desktop Code, Cowork and local Chat session history, including normal/third-party profiles and both macOS and Windows storage layouts.
- Detects shared Claude Code transcripts, short session directories and Windows MSIX app data; deduplicates shared logs and falls back to audit logs or initial-message metadata when needed.
- Handles Unicode/space-containing paths, Windows UNC paths and CRLF transcripts; keeps Desktop deletion and CLI resume disabled to protect client-owned session indexes.
- Preserves local Codex settings when switching providers, including Windows sandbox preferences, plugins, skills and profiles; aligns the integration regression fixture with local-profile preservation.
- Adds cross-platform history discovery, UI and Windows-native path regression tests.

## 0.4.0 — 2026-10-03

- Promotes the redesigned Agent workbench to the main branch, with unified providers, profiles, route policies, usage, sessions, MCP, and Skills.
- Removes the embedded HRouter account portal, payments, orders, announcements, cloud billing, pricing sync, and account-balance polling. Keeps sign-in-free HRouter API-key quick setup and local Agent tools.
- Retains local usage, provider-level usage queries, and Agent widgets; retires legacy account-balance widget payloads.
- Adds lightweight provider workflows for Pi Agent, DeepSeek Harness, and WorkBuddy.
- Preserves Codex legacy provider aliases at runtime so existing official-proxy sessions can resume after switching providers, without rewriting chat history.
- Refreshes repository documentation and privacy-reviewed native desktop screenshots.
- Publishes the release only after Windows x64 and signed/notarized macOS Universal installers and updater entries have been validated.

## 0.2.15

- Recommended GPT-5.5, all three GPT-5.6 tiers (Luna, Terra, and Sol), and GPT-6 Astra separately instead of collapsing GPT-5.6 into one entry.
- Added one-click recommended mapping reset to provider settings and API key import, replacing old unrelated catalog entries only when explicitly requested.
- Filled readable model names, used only models available to the current key, and preserved supported default aliases without duplicating tiers.
- Distinguished fetched model counts from configured mapping counts while retaining manual model mapping and refresh behavior.

## 0.2.14

- Exposed editable Codex model mappings in provider settings and API key import, including display names, actual model IDs, and adding/removing catalog entries.
- Preserved custom mappings across model discovery and saves, and allowed manual configuration when model discovery is unavailable.
- Synchronized the default model between the form, raw TOML editor, and generated catalog; rejected blank or duplicate mapping IDs.
- Kept the model discovery dropdown from submitting the provider form accidentally.

## 0.2.13

- Focused HRouter Codex model pickers and generated catalogs on GPT-5.4, GPT-5.5, GPT-5.6, and GPT-6, keeping one available model per family while preserving explicit selections.
- Restored multi-level reasoning settings instead of the native template's binary none/high options, preferring exact Codex model capability metadata when available.
- Added regression coverage for model filtering, reasoning metadata validation, and native tool compatibility.

## 0.2.12

- Added every model returned by HRouter, including GPT-6 Astra, to the generated Codex model catalog so it can be selected from the `/model` menu.

## 0.2.11

- Added a native macOS WidgetKit extension for today's HRouter usage and remaining balance.
- Fixed HRouter usage pagination being pushed below the application viewport.
- Added signed nested-extension verification to the macOS release pipeline.

## 0.2.10

- Fixed dialog layering so window chrome and sidebar dividers stay behind the modal backdrop.
- Added a macOS menu bar summary for today's HRouter usage and remaining account balance.
- Prevented unsafe in-place updates from disk images, translocated apps, and cross-volume locations, with a guided manual installer fallback.

## 0.2.9

- Removed the unintended bottom padding from the application shell so the main content and sidebar share the same bottom edge.
- Fixed the clipped final row and blank strip at the bottom of HRouter account pages.

## 0.2.8

- Fixed the desktop API allowlist so the account features added in 0.2.7 can reach HRouter.net after sign-in.
- Covered referral rewards, usage statistics, groups, model pricing, redemption, profile, and password routes with allowlist regression tests.
- Avoided showing a misleading 0% referral rate when referral data cannot be loaded.

## 0.2.7

- Expanded the HRouter dashboard with filterable usage charts, model rankings, response-time gauges, and consistent live account totals.
- Rebuilt usage records with complete request fields, filters, pagination, responsive scrolling, and collapsible details.
- Upgraded billing with payment methods, recharge estimates, referral rewards, redemption, and a dedicated personal order history.
- Added API key group selection, editing, model mapping, and guided one-click import into supported Agents.
- Added profile and password management, direct website access, refreshed FAQ guidance, and an interactive feature tour.
- Added operating-system-aware Codex GUI detection with Windows and Apple Silicon macOS offline downloads.

## 0.2.6

- Added native HRouter.net account sign-in and registration with locally stored account sessions.
- Added native dashboard, usage records, billing, order history, and API key management views.
- Read platform announcements from the public HRouter.net API without sending local provider keys.
- Reorganized the sidebar around HRouter platform services and local Agent configuration, with the after-sales QQ group above Settings.
- Fixed blank release notes by reading updater `notes`, `body`, and publication metadata.
- Removed the obsolete embedded web entry and related iframe permission.

## 0.2.5

- Reorganized HRouter Desktop around a persistent left navigation and a quieter task-focused header.
- Embedded HRouter announcements and services inside the desktop application.
- Reduced Settings to essential language, theme, Agent visibility, window behavior, and product information controls with automatic saving.
- Fixed HRouter connectivity checks that previously failed while following the `/v1` redirect.
- Removed the terminal workbench and its PTY dependencies while retaining the existing native OS terminal launch path.

## 0.2.1

- Added editable Codex context-window and automatic-compaction settings for HRouter providers.
- Changed new HRouter Codex providers to a 272K context window with compaction at 90% by default.
- Rebuilt the updater signing and GitHub Releases pipeline. Users on 0.2.0 must install 0.2.1 manually once; later releases can update in the app.

## 0.2.0

- Rebranded the desktop application as HRouter Desktop.
- Added the built-in HRouter provider and multi-Key configurations per Agent.
- Added Key recognition and live model discovery through HRouter.
- Added model mapping for Claude Code, Codex, Gemini CLI, Grok Build, OpenCode, OpenClaw, and Hermes.
- Added subscription and pay-as-you-go usage summaries with per-model statistics.
- Removed user-facing cloud synchronization and third-party provider setup from the HRouter workflow.
- Updated the official website, API, and updater endpoints to `https://hrouter.net/`.

Earlier history is available in Git and in the [CC Switch upstream repository](https://github.com/farion1231/cc-switch).
