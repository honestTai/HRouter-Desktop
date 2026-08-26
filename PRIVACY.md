# HRouter Desktop privacy policy

Last updated: August 26, 2026

This policy covers the HRouter Desktop application. HRouter Desktop is a
local-first configuration tool and does not include advertising, behavioral
analytics, or telemetry sent to the project maintainer.

## Data stored on your device

Depending on the features you use, HRouter Desktop stores the following data in
local application and agent configuration files:

- HRouter and third-party API keys;
- provider endpoints, model mappings, and application settings;
- locally calculated or retrieved usage summaries;
- local proxy statistics, logs, backups, and session metadata;
- paths and settings for supported AI coding agents.

This data remains on your device until you remove it through the application or
delete the related application and agent configuration files. Uninstalling the
application may leave configuration files in your user profile so that settings
can survive a reinstall.

## Network requests

HRouter Desktop makes network requests only for features selected or configured
by the user:

- When you add an HRouter Key, the key is sent to `https://hrouter.net` to
  authenticate model-list and usage requests. For the active HRouter provider,
  usage information can be refreshed automatically at the configured interval.
- When an AI coding agent uses an enabled HRouter configuration, that agent sends
  prompts, files, tool results, model identifiers, and request metadata to the
  HRouter API as required to provide the requested model service.
- If you configure another provider or network service, requests and credentials
  are sent to the endpoint you selected. The selected provider processes that
  data under its own terms and privacy policy.
- Optional features such as model-price synchronization, WebDAV synchronization,
  remote skill discovery, or update checks contact their displayed third-party
  endpoints only when those features are enabled or invoked.
- GitHub Releases may be contacted to download an installer or, in releases where
  update checking is enabled, to check for application updates.

HRouter Desktop does not send API keys, prompts, files, or local configuration
data to the project maintainer outside the user-selected services described
above.

## Logs and crash reports

Application logs and crash reports are created locally. They are not uploaded
automatically. If you choose to attach logs to a GitHub issue or security report,
remove API keys, OAuth tokens, cookies, prompts, file contents, and other personal
or confidential information first.

## Your controls

You can stop further provider requests by disabling or deleting the provider,
remove locally stored credentials in HRouter Desktop, disable optional network
features, and uninstall the application. You can request support or report a
privacy or security concern through a private
[GitHub Security Advisory](https://github.com/honestTai/HRouter-Desktop/security/advisories/new).

## Third-party services

HRouter Desktop links to or interoperates with HRouter, GitHub, models.dev,
user-selected AI model providers, and other services explicitly configured by
the user. Those services are independent data controllers and their own terms and
privacy policies apply to data they receive.

## Policy changes

Material changes to this policy will be published in this repository and noted in
the relevant release documentation.
