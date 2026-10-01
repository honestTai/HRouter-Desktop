# macOS WidgetKit gallery discovery / bootstrap fix

## Observed failure

On 2026-10-01, the installed `/Applications/HRouter.app` contained the extension and `pluginkit -m -A -D -vv -i com.hrouter.desktop.widget` listed it. Nevertheless it was absent from the widget gallery.

System logs and the HRouterWidget crash reports at 21:37–21:43 showed repeated `EXC_BREAKPOINT / SIGTRAP` at `ExtensionFoundation._EXRunningExtension._shared`, called through WidgetKit from the executable's Swift `main`. This was a runtime bootstrap failure, not merely a missing bundle or a failed search term. Old debug and mounted DMG copies were also registered; no global extension databases, user widgets, or system caches were reset.

## Build comparison and fix

The old hook linked a standalone `swiftc` executable. Comparing it with an Xcode `com.apple.product-type.app-extension` build of the same source showed that the standard build adds `-e _NSExtensionMain`, app-extension linker settings, runtime paths and generated platform/SDK metadata. The old binary had no `_NSExtensionMain` import and entered its Swift main directly.

- Added `macos-widget/HRouterWidget.xcodeproj`, with relative paths, an actual app-extension target, macOS 12 deployment target and Release configuration.
- The existing build hook now calls `xcodebuild`, keeps ARM64/Intel/universal architecture selection, then uses the existing Developer ID signing procedure.
- The hook refuses a binary without the `_NSExtensionMain` bootstrap symbol.
- Raised the default extension build number from 1 to 2; the product version remains 0.3.1.
- Added two packaging regression tests. Neither the app UI nor account/data logic changed in this fix.

## Verification scope

- Xcode app-extension build of the existing Swift source succeeded.
- Corrected binary imports `_NSExtensionMain`; the old installed binary does not. Their LC_MAIN offsets differ accordingly.
- Two packaging tests passed; shell syntax check passed.
- The updated application/extension and DMG are signed and integrity-checked during packaging.
- The repaired package has not been installed over the user's running app automatically. Actual gallery visibility still requires installation and reopening the gallery; signing or symbol checks alone do not constitute visual acceptance.
- Apple notarization remains incomplete, as with the preceding test package.

## User validation

Quit HRouter. Eject old mounted HRouter installer images to avoid launching an old copy. Replace the app in Applications using the new package, launch it once, then close and reopen Edit Widgets and search for HRouter. The extension should report build 2 in the installed bundle. If it is still missing, inspect newly generated extension launch logs rather than resetting all widgets or repeatedly reinstalling the unchanged package.
