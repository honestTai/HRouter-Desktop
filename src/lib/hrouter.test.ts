import { describe, expect, it } from "vitest";
import type { FetchedModel } from "@/lib/api/model-fetch";
import {
  buildHRouterProviderMeta,
  buildHRouterSettingsConfig,
  deriveHRouterModelMapping,
  HROUTER_OPENAI_BASE_URL,
  HROUTER_ORIGIN,
} from "./hrouter";

const models: FetchedModel[] = [
  { id: "claude-haiku-4-5", ownedBy: "anthropic" },
  { id: "claude-sonnet-5", ownedBy: "anthropic" },
  { id: "claude-opus-5", ownedBy: "anthropic" },
  { id: "gpt-5.5", ownedBy: "openai" },
  { id: "gpt-5.6-luna", ownedBy: "openai" },
];

describe("HRouter provider configuration", () => {
  it("maps Claude roles from the models returned by the Key", () => {
    expect(deriveHRouterModelMapping("claude", models)).toEqual({
      primary: "claude-sonnet-5",
      haiku: "claude-haiku-4-5",
      sonnet: "claude-sonnet-5",
      opus: "claude-opus-5",
    });
  });

  it("selects the first compatible Codex model returned by HRouter", () => {
    expect(deriveHRouterModelMapping("codex", models).primary).toBe("gpt-5.5");
  });

  it("builds Claude Code config from only the Key and imported models", () => {
    const mapping = deriveHRouterModelMapping("claude", models);
    const config = buildHRouterSettingsConfig(
      "claude",
      " sk-hrouter-test ",
      mapping,
      models,
    ) as { env: Record<string, string> };

    expect(config.env.ANTHROPIC_BASE_URL).toBe(HROUTER_ORIGIN);
    expect(config.env.ANTHROPIC_AUTH_TOKEN).toBe("sk-hrouter-test");
    expect(config.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe("claude-opus-5");
  });

  it("builds the HRouter Codex Responses route with remote compaction enabled", () => {
    const mapping = deriveHRouterModelMapping("codex", models);
    const config = buildHRouterSettingsConfig(
      "codex",
      "sk-hrouter-test",
      mapping,
      models,
    ) as { auth: Record<string, string>; config: string };

    expect(config.auth.OPENAI_API_KEY).toBe("sk-hrouter-test");
    expect(config.config).toContain('model_provider = "4router"');
    expect(config.config).toContain('name = "OpenAI"');
    expect(config.config).toContain(`base_url = "${HROUTER_OPENAI_BASE_URL}"`);
    expect(config.config).toContain('wire_api = "responses"');
  });

  it("registers every imported model for OpenCode", () => {
    const mapping = deriveHRouterModelMapping("opencode", models);
    const config = buildHRouterSettingsConfig(
      "opencode",
      "sk-hrouter-test",
      mapping,
      models,
    ) as {
      options: Record<string, string>;
      models: Record<string, { name: string }>;
    };

    expect(config.options.baseURL).toBe(HROUTER_OPENAI_BASE_URL);
    expect(Object.keys(config.models)).toHaveLength(models.length);
    expect(config.models["gpt-5.6-luna"].name).toBe("gpt-5.6-luna");
  });

  it("marks Claude Desktop as a direct HRouter route", () => {
    const mapping = deriveHRouterModelMapping("claude-desktop", models);
    const meta = buildHRouterProviderMeta("claude-desktop", mapping);

    expect(meta.providerType).toBe("hrouter");
    expect(meta.claudeDesktopMode).toBe("direct");
    expect(meta.claudeDesktopModelRoutes?.["claude-opus-5"]?.model).toBe(
      "claude-opus-5",
    );
  });
});
