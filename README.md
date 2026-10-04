<div align="center">

<img src="src-tauri/icons/128x128.png" width="96" alt="HRouter Desktop">

# HRouter Desktop

### Less configuration. More coding.

**One desktop app for your AI coding agents, providers, and model routes.**<br>
Connect a service. Review your configuration. Choose your fallback. Get back to building.

[![Release](https://img.shields.io/github/v/release/honestTai/HRouter-Desktop?color=16a085&label=release)](https://github.com/honestTai/HRouter-Desktop/releases/latest)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows-5263d6)](#download)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**English** | [简体中文](README_ZH.md)

[Download](#download) · [Why HRouter Desktop](#why-hrouter-desktop) · [Screenshots](#screenshots) · [Compared with CC Switch](#compared-with-cc-switch) · [Get started](#get-started)

</div>

![HRouter Desktop: an agent-first configuration workbench](assets/screenshots/workbench-en.png)

## Why HRouter Desktop?

Different agents. Different config files. Different providers. Switching your coding setup should not mean piecing all of them together again.

**HRouter Desktop puts the connection workflow in one place:** providers, API keys, model mappings, configuration protection, backup routes, and usage. Built on CC Switch, it adds an agent-first interface and a focused workflow for the services you choose.

- **11 agents, one workbench.** Move between Claude Code, Codex, Gemini CLI, and more without learning a different configuration UI for each.
- **Switch with a preview, not a guess.** Opt into Claude / Codex configuration protection to preserve custom fields, preview changes, and keep local switch snapshots.
- **Give your models a backup plan.** Choose primary and backup providers, define exact-model routes, and use automatic failover through supported local routing.
- **Keep repeatable setups.** Save provider, MCP, and Skill selections as access profiles; review them before applying.
- **See how your tools are being used.** Inspect requests, tokens, cache usage, and estimated costs, with an agent-scoped floating usage window.
- **Use the service you want.** Official providers, self-hosted endpoints, and compatible gateways are welcome. No HRouter account is required to use the desktop app.

## Download

| Platform    | Package                                                                                               | Architecture                              |
| ----------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **macOS**   | [Download from Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest) · `.dmg`       | Apple Silicon (M-series) only · macOS 12+ |
| **Windows** | [Download from Releases](https://github.com/honestTai/HRouter-Desktop/releases/latest) · `-setup.exe` | x64                                       |

> **v0.4.0 is available.** Download the latest release above, or check for updates in the app. macOS packages support Apple Silicon (M-series) only; Intel Macs are not supported.

[Changelog](CHANGELOG.md) · [Code-signing policy](CODE_SIGNING_POLICY.md)

## Connect with HRouter

<table>
<tr>
<td width="110" align="center"><a href="https://hrouter.net/"><img src="src-tauri/icons/128x128.png" width="72" alt="HRouter"></a></td>
<td>
<strong>Your HRouter key. Your agents. Less setup.</strong><br><br>
Have an HRouter API key? Select your agent, discover the models available to your key, and review the generated configuration—all from the workbench.<br><br>
<a href="https://hrouter.net/"><strong>Explore HRouter →</strong></a> · Manage your service account on the website. Connect your coding tools on the desktop.
</td>
</tr>
</table>

HRouter quick setup is optional; other compatible providers use the same workbench. Available models and pricing depend on your key and the service. The desktop app has no embedded HRouter account, top-up, or order-management pages.

## Features

### Connect and check

- **Provider library:** official presets and custom endpoints, multiple saved providers per agent, editable keys and model mappings.
- **HRouter quick setup:** key-based model discovery and agent-specific configuration, without a platform login.
- **Connection checks:** inspect the model catalog, then optionally test text responses, streaming, tool calls, and tool-result continuation. Real-request checks support Claude / Codex API-key providers and require acknowledgement of possible charges.

### Protect and reuse

- **Configuration protection:** opt-in field-preserving Claude / Codex switching, change previews, local snapshots, and conflict-checked restore.
- **Lite mode:** focus on connection settings without application-managed MCP, Skills, or prompt writes. Includes prompt protection and provider-only sync scope.
- **Access profiles:** save and reapply provider, MCP, and Skill selections. Profiles reference your providers; they are not full configuration backups.
- **Environment targets:** preview and deploy supported Claude / Codex API-key configurations to existing Windows / WSL-accessible directories.

### Route and observe

- **Primary and backup routes:** ordered failover queues and exact-model route chains through the local proxy. You choose the providers; HRouter is not automatically added.
- **Usage analytics:** request logs, token and cache breakdowns, trends, provider/model summaries, and local cost estimates.
- **Provider usage:** query configured provider usage interfaces; inspect multi-key quotas with explicit rules for combining independent balances.
- **Desktop visibility:** a floating agent usage window and macOS widget integration.

### Manage your agent workspace

- **Sessions:** browse supported local agent conversations and resume work in the relevant client.
- **MCP and Skills:** manage shared resources with per-agent enablement, Skills discovery, and supported import/export and backup workflows.
- **Agent-specific tools:** OpenClaw workspace files, environment variables, tool permissions, and defaults; Hermes memory and user-profile editing.
- **Everyday utilities:** CLI installation/update entry points, language and theme preferences, and in-app help.

### Supported agents

**Claude Code · Claude Desktop · Codex · Gemini CLI · Grok Build · OpenCode · OpenClaw · Hermes · Pi Agent · DeepSeek Harness · WorkBuddy**

Each agent has its own adapter. Routing, configuration protection, authentication, MCP, Skills, and usage support vary by agent; the CLI installer does not install every agent's desktop application. See the [integration guide](docs/access-workbench.md) for scope and behavior.

## Screenshots

Real macOS application captures with private configuration labels redacted. Some HRouter-specific controls still display Chinese when the interface is set to English. [Capture details and full image index](assets/screenshots/README.md).

|                     **Providers in one place**                     |                     **HRouter key quick setup**                      |
| :----------------------------------------------------------------: | :------------------------------------------------------------------: |
| ![Provider configuration](assets/screenshots/configuration-en.png) | ![Empty HRouter key setup form](assets/screenshots/key-setup-en.png) |
|        Keep saved services and the active provider visible.        |          Discover models and review mappings before saving.          |

|              **Reusable access profiles**              |                 **Explicit backup routes**                  |
| :----------------------------------------------------: | :---------------------------------------------------------: |
| ![Access profiles](assets/screenshots/profiles-en.png) | ![Route policies](assets/screenshots/route-policies-en.png) |
|            Save a setup you can return to.             |       Choose the order in which providers are tried.        |

<details>
<summary><strong>Configuration protection, MCP, Skills, and desktop usage</strong></summary>

|                  **Protect local configuration**                  |             **Manage MCP resources**             |
| :---------------------------------------------------------------: | :----------------------------------------------: |
| ![Configuration protection](assets/screenshots/protection-en.png) | ![MCP management](assets/screenshots/mcp-en.png) |

![Skills discovery](assets/screenshots/skills-discovery-en.png)

<img src="assets/screenshots/usage-widget-en.png" width="400" alt="Floating agent usage window showing a genuine zero-usage state">

</details>

## Compared with CC Switch

**CC Switch provides the foundation. HRouter Desktop changes how you work with it.** We retain the upstream provider, proxy, MCP, Skills, session, and usage foundations rather than presenting them as new inventions.

| Focus                                | What this fork changes                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent-first interface**            | A redesigned workbench and top navigation, with dedicated Configuration, Profiles, Route policies, and Usage pages.                               |
| **Deliberate configuration changes** | A protection workflow with previews, fingerprint checks, snapshots, guarded restores, Lite mode, and prompt protection.                           |
| **Repeatable access setups**         | Dedicated profiles for provider, MCP, and Skill selections, with a preview before application.                                                    |
| **Model-aware routing**              | Extensions to inherited routing: exact-model primary/backup chains, temporary manual preferences, and controlled multi-key quota aggregation.     |
| **Compatibility and continuity**     | Protocol-aware connection checks, targeted proxy transport fixes, and Codex legacy-provider compatibility without rewriting conversation history. |
| **Usage correctness**                | Targeted fixes for Codex fork usage, Claude cache-TTL estimates, and OpenCode rollup/deduplication.                                               |
| **HRouter and desktop integration**  | Optional HRouter key setup, DeepSeek Harness / WorkBuddy integration work, and agent-scoped desktop usage tools.                                  |
| **A focused desktop**                | v0.4.0 removes the account, payment, order, and cloud-billing modules from earlier **HRouter** versions—not from CC Switch.                       |

This is a summary of changes maintained in this fork, not a claim that current upstream lacks every listed capability. The projects evolve independently. For implementation details and validation limits, see the [workbench guide](docs/access-workbench.md), [fix checklist](docs/issue-remediation.md), and [upstream contribution records](docs/upstream-contributions.md).

## Get started

1. **Install and choose an agent.** Open the workbench and select the coding tool you want to configure.
2. **Connect a service.** Add a provider preset or a custom endpoint and key. For HRouter, select **Add HRouter key** and review the discovered models.
3. **Review, save, and enable.** Check the model mapping and configuration, then enable the provider. Refresh or restart the target client if required.

That's the basic setup. Add protection, profiles, or backup routes when you need them; opt into a billable connection test only after checking the catalog.

### Moving from CC Switch?

Use **Agents → Connect → Import from CC Switch** to preview your actual `cc-switch.db` file read-only and select providers to import. The importer does not change the source database, overwrite existing entries, or activate imported providers.

This imports providers—not a whole account. Managed OAuth sessions, prompts, Skills, usage scripts, and OMO configuration are excluded. Existing HRouter users do not need to delete their keys or configuration directories to upgrade.

## Good to know

- **Local-first, not offline-only.** Provider calls, model discovery, usage queries, Skills discovery, pricing, and updates contact the relevant services. Treat local keys, configuration files, and snapshots as sensitive.
- **Estimates, not invoices.** Usage depends on available local records and configured prices. A passing connection check is not a guarantee of model identity, quality, or long-task reliability.
- **Protection has a scope.** It is opt-in for Claude / Codex. Restore checks preserve later edits rather than forcing an overwrite; provider-only sync and profiles are not full backups.
- **Signing types differ.** Tauri updater signatures are not Windows Authenticode signatures. macOS publication requires Developer ID signing and notarization.

[Privacy](PRIVACY.md) · [Security](SECURITY.md) · [Signing](CODE_SIGNING_POLICY.md)

## Build and contribute

Built with **Tauri 2 · Rust · React · TypeScript**. Use the project lockfile, `pnpm@10.12.3`, and your platform's Tauri build prerequisites.

```bash
git clone https://github.com/honestTai/HRouter-Desktop.git
cd HRouter-Desktop
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm build` builds for the host platform. See [Contributing](CONTRIBUTING.md) for checks and contribution guidelines, and [macOS signing](docs/macos-signing.md) for release setup.

Found a bug or have a workflow to improve? [Open an issue](https://github.com/honestTai/HRouter-Desktop/issues). If HRouter Desktop is useful to you, give the repository a star.

## Credits and license

Based on **[CC Switch](https://github.com/farion1231/cc-switch)** by **Jason Young** and its contributors. HRouter Desktop is independently maintained by [honestTai](https://github.com/honestTai) and HRouter Contributors; it is not an official CC Switch release or endorsed by its maintainers.

The original copyright and MIT license are preserved. Some internal `cc-switch` identifiers remain for compatibility and migration.

[MIT License](LICENSE) · [Attribution](NOTICE.md)
