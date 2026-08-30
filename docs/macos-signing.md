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

Run the **macOS Signed Universal Release** workflow for an existing release tag.
It builds universal `app` and `dmg` bundles, lets Tauri sign and notarize them,
and refuses to upload artifacts unless all of these checks pass:

```bash
codesign --verify --deep --strict --verbose=2 HRouter.app
spctl --assess --type execute --verbose=4 HRouter.app
xcrun stapler validate HRouter.app
spctl --assess --type open --context context:primary-signature --verbose=4 HRouter.dmg
xcrun stapler validate HRouter.dmg
```

The workflow uploads the DMG, the universal Tauri updater archive, and its
signature. It then adds both `darwin-aarch64` and `darwin-x86_64` entries to the
existing `latest.json` without replacing Windows entries.
