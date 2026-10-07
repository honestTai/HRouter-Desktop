import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

describe("macOS widget bootstrap packaging", () => {
  it("uses an app-extension target rather than a bare Swift executable", () => {
    const project = read(
      "src-tauri/macos-widget/HRouterWidget.xcodeproj/project.pbxproj",
    );
    expect(project).toContain("com.apple.product-type.app-extension");
    expect(project).toContain("APPLICATION_EXTENSION_API_ONLY");
    expect(project).toContain("@executable_path/../../../../Frameworks");
    expect(project).not.toContain("/Users/");
    const script = read("scripts/build-macos-widget.sh");
    expect(script).toContain('"$widget_dir/HRouterWidget.xcodeproj"');
    expect(script).not.toContain("xcrun swiftc");
    expect(script).toContain("_NSExtensionMain");
  });

  it("bumps the extension build and preserves signing and architecture support", () => {
    const script = read("scripts/build-macos-widget.sh");
    expect(script).toContain("HROUTER_WIDGET_BUILD_NUMBER:-3");
    expect(script).toContain('"ARCHS=${architectures[*]}"');
    expect(script).toContain("codesign --verify --strict");
    expect(read("src-tauri/macos-widget/Info.plist")).toContain(
      "com.apple.widgetkit-extension",
    );
  });
});
