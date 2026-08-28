# Changelog

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
