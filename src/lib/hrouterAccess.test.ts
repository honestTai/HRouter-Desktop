import { describe, expect, it } from "vitest";
import { APP_IDS } from "@/config/appConfig";
import { buildHRouterSettingsConfig } from "@/lib/hrouter";
import { hasHRouterKey } from "./hrouterAccess";

const mapping = {
  primary: "test-model",
  haiku: "test-model",
  sonnet: "test-model",
  opus: "test-model",
};
describe("hasHRouterKey", () => {
  it.each(APP_IDS)("recognizes %s with an endpoint and nonempty key", (app) => {
    expect(
      hasHRouterKey(app, {
        id: "test",
        name: "Any name",
        settingsConfig: buildHRouterSettingsConfig(
          app,
          "test-only-key",
          mapping,
          [],
        ),
      }),
    ).toBe(true);
    expect(
      hasHRouterKey(app, {
        id: "test",
        name: "HRouter",
        settingsConfig: buildHRouterSettingsConfig(app, "  ", mapping, []),
      }),
    ).toBe(false);
  });
  it.each([
    "https://hrouter.net.evil.example/v1",
    "https://evil.example/hrouter.net",
    "https://hrouter.net@evil.example/v1",
    "http://hrouter.net/v1",
    "not-a-url",
  ])("rejects unrelated or insecure endpoints: %s", (baseUrl) => {
    expect(
      hasHRouterKey("openclaw", {
        id: "test",
        name: "HRouter",
        meta: { providerType: "hrouter" },
        websiteUrl: "https://hrouter.net",
        settingsConfig: { baseUrl, apiKey: "test" },
      }),
    ).toBe(false);
  });
  it("does not infer access from metadata or unresolved environment references", () => {
    expect(
      hasHRouterKey("pi", {
        id: "test",
        name: "HRouter",
        settingsConfig: {
          baseUrl: "https://hrouter.net",
          credentialMode: "env",
          credential: "HROUTER_KEY",
        },
      }),
    ).toBe(false);
    expect(
      hasHRouterKey("claude", {
        id: "test",
        name: "HRouter",
        settingsConfig: {
          env: {
            ANTHROPIC_BASE_URL: "https://hrouter.net",
            ANTHROPIC_AUTH_TOKEN: "${HROUTER_KEY}",
          },
        },
      }),
    ).toBe(false);
  });
  it("ignores unused Codex provider tables", () => {
    expect(
      hasHRouterKey("codex", {
        id: "test",
        name: "HRouter",
        settingsConfig: {
          auth: { OPENAI_API_KEY: "test" },
          config:
            'model_provider = "other"\n[model_providers.hrouter]\nbase_url = "https://hrouter.net/v1"\n[model_providers.other]\nbase_url = "https://example.com/v1"',
        },
      }),
    ).toBe(false);
  });
});
