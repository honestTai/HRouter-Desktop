# Code signing policy

For releases approved under this policy, free code signing is provided by
[SignPath.io](https://signpath.io/), with a certificate provided by the
[SignPath Foundation](https://signpath.org/).

The SignPath Foundation application is currently pending. The Windows installer
published for v0.2.1 is not Authenticode-signed. This document describes the
controls that will apply to the first signed release and later releases.

## Signed artifacts

- HRouter Desktop Windows installers and HRouter-owned executable files built
  from this repository may be signed.
- Third-party or upstream binaries are not signed as HRouter-owned files.
- Tauri updater signatures are generated separately and continue to protect
  application updates in transit.

## Roles

- Committer and author: [@honestTai](https://github.com/honestTai)
- Reviewer for external contributions: [@honestTai](https://github.com/honestTai),
  assigned through [CODEOWNERS](.github/CODEOWNERS)
- Approver for code-signing requests: [@honestTai](https://github.com/honestTai)

Changes submitted by people without direct commit access must be reviewed before
they are merged. A signing request must be manually approved by the signing
approver after the source revision, build result, and release metadata have been
checked.

## Build and release controls

1. Release artifacts are built from a public Git tag by GitHub Actions.
2. The tag and all application version declarations must match exactly.
3. The repository CI must pass before a release tag is published.
4. The build workflow and dependency lock files are part of the reviewed source.
5. SignPath origin verification must associate every signed artifact with this
   repository and the exact source revision that produced it.
6. The Windows installer is submitted for Authenticode signing before the Tauri
   updater signature and update manifest are finalized.
7. Release digests and updater signatures are published with each GitHub Release.

## Privacy

See the [HRouter Desktop privacy policy](PRIVACY.md). HRouter Desktop does not
include advertising or maintainer-operated analytics. Network requests and the
data sent to user-selected services are documented in that policy.
