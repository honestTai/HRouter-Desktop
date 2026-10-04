# macOS signing and notarization

HRouter Desktop is distributed outside the Mac App Store. A release must use an
Apple `Developer ID Application` certificate and Apple notarization. The Tauri
updater key is separate: it protects update integrity but does not satisfy
Gatekeeper.

## Apple prerequisites

- An active Apple Developer Program membership.
- The Account Holder role for creating a Developer ID certificate.
- A `Developer ID Application` certificate with its private key, exported from
  Keychain Access as a password-protected `.p12` file.
- An app-specific password for the Apple Account used by the notary service.

Create the certificate in Apple Developer under **Certificates, Identifiers &
Profiles > Certificates > + > Developer ID > Developer ID Application**. Install
the downloaded certificate on the Mac that created the certificate request,
then export the certificate and its private key together from \*\*Keychain Access

> My Certificates\*\*.

## GitHub Actions secrets

Configure these repository Actions secrets:

| Secret                               | Value                                                        |
| ------------------------------------ | ------------------------------------------------------------ |
| `APPLE_CERTIFICATE`                  | Base64-encoded contents of the exported `.p12` file          |
| `APPLE_CERTIFICATE_PASSWORD`         | Password used when exporting the `.p12` file                 |
| `APPLE_ID`                           | Apple Account email used for notarization                    |
| `APPLE_PASSWORD`                     | App-specific password, not the normal Apple Account password |
| `APPLE_TEAM_ID`                      | Ten-character Apple Developer Team ID                        |
| `TAURI_SIGNING_PRIVATE_KEY`          | Existing Tauri updater private key                           |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Existing Tauri updater key password                          |

Encode the certificate without line wrapping:

```bash
openssl base64 -A -in DeveloperIDApplication.p12
```

Never commit a certificate, certificate request, private key, app-specific
password, or base64-encoded credential. The repository ignores the common
certificate file extensions as a second line of defense.

## Release and verification

Run the **macOS Signed Apple Silicon Release** workflow for an existing release tag.
It builds arm64-only `app` and `dmg` bundles for Apple Silicon (M-series) Macs, lets Tauri sign and notarize them,
and refuses to upload artifacts unless all of these checks pass:

```bash
codesign --verify --deep --strict --verbose=2 HRouter.app
spctl --assess --type execute --verbose=4 HRouter.app
xcrun stapler validate HRouter.app
spctl --assess --type open --context context:primary-signature --verbose=4 HRouter.dmg
xcrun stapler validate HRouter.dmg
```

The workflow verifies that both the app and WidgetKit extension contain only
`arm64` executables, then uploads the `HRouter_<version>_aarch64.dmg`, Tauri
updater archive, and its signature. It adds `darwin-aarch64` to `latest.json`
without replacing Windows entries, removes any `darwin-x86_64` entry, and
removes obsolete Intel/universal DMGs for that same release. Intel Macs are not
supported starting with v0.4.0.

Application sources are checked out from the release tag. Release notes are
read from the workflow dispatch revision, so draft notes can be corrected
without moving the tag; the GitHub release body and updater notes are kept in sync.

Leave the `publish` input at its default `false` while testing. The workflow
validates both desktop platforms but keeps a draft unpublished unless `publish`
is explicitly enabled. A successful build alone does not approve public release.
