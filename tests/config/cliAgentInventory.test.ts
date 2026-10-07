import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_IDS, SESSION_APP_IDS } from "@/config/appConfig";
describe("CLI installation inventory", () => {
  it("supports local Claude Desktop history as a separate session source", () => {
    expect(SESSION_APP_IDS).toContain("claude-desktop");
    expect(SESSION_APP_IDS).toContain("claude");
  });
  it("only removes GUI installers, not desktop configuration support", () => {
    expect(APP_IDS).toContain("claude-desktop");
    expect(APP_IDS).toContain("workbuddy");
    const ui = fs.readFileSync("src/components/AgentManagerButton.tsx", "utf8");
    expect(ui).not.toMatch(
      /getCodexGuiStatus|launchCodexGuiInstaller|desktopAgents/,
    );
    const backend = fs.readFileSync("src-tauri/src/commands/misc.rs", "utf8");
    for (const [tool, pkg] of [
      ["pi", "@earendil-works/pi-coding-agent"],
      ["dsh", "@deepseek-ai/dsh"],
      ["codebuddy", "@tencent-ai/codebuddy-code"],
    ]) {
      expect(ui).toContain(`name: "${tool}"`);
      expect(backend).toContain(pkg);
    }
  });
});
