#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/hrouter-widget-tests.XXXXXX")"
trap 'rm -rf "$build_dir"' EXIT
# Compile the real widget implementation with only its @main entry point disabled.
xcrun swiftc -swift-version 5 -D WIDGET_TESTING \
  "$repo_dir/src-tauri/macos-widget/HRouterWidget.swift" \
  "$repo_dir/tests/native/WidgetStoreTests.swift" \
  -o "$build_dir/widget-tests"
"$build_dir/widget-tests"
# Validate the actual app-extension target too, including AppIntents metadata.
xcodebuild -project "$repo_dir/src-tauri/macos-widget/HRouterWidget.xcodeproj" \
  -target HRouterWidget -configuration Release -quiet \
  "ARCHS=$(uname -m)" ONLY_ACTIVE_ARCH=YES \
  "CONFIGURATION_BUILD_DIR=$build_dir/extension" \
  "SYMROOT=$build_dir/xcode" "OBJROOT=$build_dir/obj" \
  CODE_SIGNING_ALLOWED=NO build
xcrun nm -u "$build_dir/extension/HRouterWidget.appex/Contents/MacOS/HRouterWidget" > "$build_dir/symbols"
grep -q '_NSExtensionMain' "$build_dir/symbols"
python3 - "$build_dir/extension/HRouterWidget.appex/Contents/Resources/Metadata.appintents/extract.actionsdata" <<'PY'
import json, sys
with open(sys.argv[1]) as stream:
    metadata = json.load(stream)
assert "SelectAgentIntent" in metadata["actions"], "Widget Agent configuration must be exported"
assert any(p["name"] == "agent" for p in metadata["actions"]["SelectAgentIntent"]["parameters"])
print("Widget extension: NSExtensionMain and Agent configuration metadata verified")
PY
