#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
widget_dir="$repo_dir/src-tauri/macos-widget"
build_dir="$widget_dir/build"
bundle_dir="$build_dir/HRouterWidget.appex"
binary_dir="$bundle_dir/Contents/MacOS"
binary_path="$binary_dir/HRouterWidget"
version="$(node -p "require('$repo_dir/package.json').version")"
requested_arch="${TAURI_ENV_ARCH:-$(uname -m)}"
temporary_keychain=""
temporary_signing_dir=""
original_user_keychains=()

cleanup_signing_material() {
  if [[ -n "$temporary_keychain" ]]; then
    if [[ ${#original_user_keychains[@]} -gt 0 ]]; then
      security list-keychains -d user -s "${original_user_keychains[@]}" >/dev/null 2>&1 || true
    fi
    security delete-keychain "$temporary_keychain" >/dev/null 2>&1 || true
  fi
  if [[ -n "$temporary_signing_dir" ]]; then
    rm -f "$temporary_signing_dir/certificate.p12"
    rmdir "$temporary_signing_dir" >/dev/null 2>&1 || true
  fi
}

trap cleanup_signing_material EXIT

case "$requested_arch" in
  universal | universal-apple-darwin)
    architectures=(arm64 x86_64)
    ;;
  aarch64 | arm64)
    architectures=(arm64)
    ;;
  x86_64)
    architectures=(x86_64)
    ;;
  *)
    echo "Unsupported macOS widget architecture: $requested_arch" >&2
    exit 1
    ;;
esac

# Build as an actual macOS app-extension target. A bare `swiftc` executable
# enters Widget.main before NSExtension initializes its host context and traps
# in ExtensionFoundation (_EXRunningExtension._shared) when the gallery loads it.
# Xcode supplies `-e _NSExtensionMain`, extension metadata and runtime paths.
xcodebuild \
  -project "$widget_dir/HRouterWidget.xcodeproj" \
  -target HRouterWidget \
  -configuration Release \
  -quiet \
  "ARCHS=${architectures[*]}" \
  ONLY_ACTIVE_ARCH=NO \
  "CONFIGURATION_BUILD_DIR=$build_dir" \
  "SYMROOT=$build_dir/xcode" \
  "OBJROOT=$build_dir/xcode/intermediates" \
  "MARKETING_VERSION=$version" \
  "CURRENT_PROJECT_VERSION=${HROUTER_WIDGET_BUILD_NUMBER:-2}" \
  CODE_SIGNING_ALLOWED=NO \
  build

# Reject a plain Swift executable even if it compiles and codesigns correctly.
# Save nm output first: grep -q with pipefail can otherwise terminate nm early.
undefined_symbols="$(xcrun nm -u "$binary_path")"
if ! grep -q '_NSExtensionMain' <<< "$undefined_symbols"; then
  echo "Widget is missing the NSExtensionMain bootstrap entry point." >&2
  exit 1
fi

signing_identity="${HROUTER_WIDGET_SIGNING_IDENTITY:-}"
if [[ -z "$signing_identity" ]]; then
  signing_identity="$(security find-identity -v -p codesigning 2>/dev/null \
    | awk '/"Developer ID Application: .* \(QA2AVNA553\)"/ { print $2 }' \
    | head -n 1)"
fi

# Tauri imports APPLE_CERTIFICATE during its own app-bundling phase, which
# happens after this hook. Import it into a short-lived keychain so the nested
# WidgetKit extension can be signed first on a clean CI runner.
if [[ -z "$signing_identity" && -n "${APPLE_CERTIFICATE:-}" && -n "${APPLE_CERTIFICATE_PASSWORD:-}" ]]; then
  while IFS= read -r keychain; do
    original_user_keychains+=("${keychain//\"/}")
  done < <(security list-keychains -d user)
  temporary_signing_dir="$(mktemp -d "$build_dir/signing.XXXXXX")"
  temporary_keychain="$temporary_signing_dir/widget-signing.keychain-db"
  keychain_password="$(openssl rand -base64 24)"
  certificate_path="$temporary_signing_dir/certificate.p12"

  printf '%s' "$APPLE_CERTIFICATE" | base64 --decode > "$certificate_path"
  security create-keychain -p "$keychain_password" "$temporary_keychain"
  security set-keychain-settings -lut 21600 "$temporary_keychain"
  security unlock-keychain -p "$keychain_password" "$temporary_keychain"
  security import "$certificate_path" \
    -k "$temporary_keychain" \
    -P "$APPLE_CERTIFICATE_PASSWORD" \
    -T /usr/bin/codesign >/dev/null
  security set-key-partition-list \
    -S apple-tool:,apple:,codesign: \
    -s \
    -k "$keychain_password" \
    "$temporary_keychain" >/dev/null
  security list-keychains -d user -s \
    "$temporary_keychain" \
    $(security list-keychains -d user | tr -d '"')

  signing_identity="$(security find-identity -v -p codesigning "$temporary_keychain" 2>/dev/null \
    | awk '/"Developer ID Application: .* \(QA2AVNA553\)"/ { print $2 }' \
    | head -n 1)"
fi

if [[ -z "$signing_identity" ]]; then
  echo "No HRouter Developer ID signing identity is available for the WidgetKit extension." >&2
  exit 1
fi

codesign \
  --force \
  --options runtime \
  --timestamp \
  --sign "$signing_identity" \
  --entitlements "$widget_dir/HRouterWidget.entitlements" \
  "$bundle_dir"

codesign --verify --strict --verbose=2 "$bundle_dir"
echo "Built signed macOS widget: $bundle_dir"
