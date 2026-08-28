import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("inline theme bootstrap CSP", () => {
  it("allows the HRouter theme script without enabling remote frames", () => {
    const html = readFileSync("src/index.html", "utf8");
    const config = JSON.parse(
      readFileSync("src-tauri/tauri.conf.json", "utf8"),
    ) as { app: { security: { csp: string } } };
    const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

    expect(inlineScript).toContain('localStorage.getItem("hrouter-theme")');
    const hash = createHash("sha256")
      .update(inlineScript ?? "")
      .digest("base64");
    expect(config.app.security.csp).toContain(`'sha256-${hash}'`);
    expect(config.app.security.csp).not.toContain("frame-src");
  });
});
