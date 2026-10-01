import { describe, it, expect } from "vitest";
import { configuredModels } from "@/utils/providerModels";
describe("configured model summaries", () => {
  it("deduplicates Claude model slots without scanning keys/secrets", () => {
    expect(
      configuredModels({
        env: {
          ANTHROPIC_MODEL: "sonnet",
          ANTHROPIC_DEFAULT_SONNET_MODEL: "sonnet",
          ANTHROPIC_DEFAULT_OPUS_MODEL: "opus",
          ANTHROPIC_AUTH_TOKEN: "secret",
        },
      }),
    ).toEqual(["sonnet", "opus"]);
  });
  it("reads Codex TOML and ignores malformed TOML", () => {
    expect(
      configuredModels({
        config: 'model = "code-model"\nmodel_provider = "relay"',
      }),
    ).toEqual(["code-model"]);
    expect(configuredModels({ config: "not valid = [" })).toEqual([]);
  });
  it("handles OpenCode dictionaries, OpenClaw arrays and unknown configurations", () => {
    expect(configuredModels({ models: { a: {}, b: {} } })).toEqual(["a", "b"]);
    expect(
      configuredModels({
        models: [{ id: "a" }, { id: "a" }, { name: "display name only" }, null],
      }),
    ).toEqual(["a"]);
    expect(configuredModels({ env: { GEMINI_MODEL: "g" } })).toEqual(["g"]);
    expect(configuredModels(null)).toEqual([]);
  });
});
