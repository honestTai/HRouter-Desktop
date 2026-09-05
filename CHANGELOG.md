# Changelog

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
