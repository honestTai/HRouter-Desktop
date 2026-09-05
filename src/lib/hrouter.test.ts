import { describe, expect, it } from "vitest";
import type { FetchedModel } from "@/lib/api/model-fetch";
import {
  buildHRouterProviderMeta,
  buildHRouterSettingsConfig,
  buildHRouterUsageScript,
  deriveHRouterModelMapping,
  getHRouterCodexModels,
  getHRouterCodexCatalog,
  buildHRouterCodexCatalog,
  extractHRouterProviderState,
  HROUTER_CODEX_DEFAULT_AUTO_COMPACT_TOKEN_LIMIT,
  HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW,
  HROUTER_CODEX_PROVIDER_ID,
  HROUTER_MODELS_URL,
  HROUTER_OPENAI_BASE_URL,
  HROUTER_ORIGIN,
  normalizeHRouterCodexProviderId,
} from "./hrouter";

const models: FetchedModel[] = [
  { id: "claude-haiku-4-5", ownedBy: "anthropic" },
  { id: "claude-sonnet-5", ownedBy: "anthropic" },
  { id: "claude-opus-5", ownedBy: "anthropic" },
  { id: "gpt-5.5", ownedBy: "openai" },
  { id: "gpt-5.6-luna", ownedBy: "openai" },
];

describe("HRouter provider configuration", () => {
  it("uses the current HRouter API domain", () => {
    expect(HROUTER_ORIGIN).toBe("https://hrouter.net");
    expect(HROUTER_MODELS_URL).toBe("https://hrouter.net/v1/models");
  });

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
    expect(config.config).toContain(
      `model_provider = "${HROUTER_CODEX_PROVIDER_ID}"`,
    );
    expect(config.config).toContain(
      `[model_providers.${HROUTER_CODEX_PROVIDER_ID}]`,
    );
    expect(config.config).toContain('name = "OpenAI"');
    expect(config.config).not.toContain("goals = true");
    expect(config.config).toContain(`base_url = "${HROUTER_OPENAI_BASE_URL}"`);
    expect(config.config).toContain('wire_api = "responses"');
    expect(config.config).toContain(
      `model_context_window = ${HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW}`,
    );
    expect(config.config).toContain(
      `model_auto_compact_token_limit = ${HROUTER_CODEX_DEFAULT_AUTO_COMPACT_TOKEN_LIMIT}`,
    );
  });

  it("registers GPT-6 Astra in the Codex model catalog", () => {
    const gpt6Models: FetchedModel[] = [
      ...models,
      { id: "gpt-6-astra", ownedBy: "openai" },
    ];
    const mapping = {
      ...deriveHRouterModelMapping("codex", gpt6Models),
      primary: "gpt-6-astra",
    };
    const settings = buildHRouterSettingsConfig(
      "codex",
      "sk-hrouter-test",
      mapping,
      gpt6Models,
    ) as {
      config: string;
      modelCatalog: { models: Array<{ model: string }> };
    };

    expect(settings.config).toContain('model = "gpt-6-astra"');
    expect(settings.modelCatalog.models[0]).toMatchObject({
      model: "gpt-6-astra",
    });
    expect(settings.modelCatalog.models).toContainEqual(
      expect.objectContaining({
        model: "gpt-5.6-luna",
      }),
    );
    expect(settings.modelCatalog.models).toHaveLength(3);
  });

  it("keeps one real model per requested family and excludes non-coding variants", () => {
    const candidates = [
      "gpt-6-astra",
      "gpt-5.6-luna",
      "gpt-5.6",
      "gpt-5.5",
      "gpt-5.4-mini",
      "gpt-5.4",
      "gpt-5.4-2026-03-05",
      "gpt-5.2",
      "gpt-4o-audio-preview",
      "gpt-image-2",
      "text-embedding-3-large",
      "codex-auto-review",
    ].map((id) => ({ id, ownedBy: "openai" }));
    expect(getHRouterCodexModels(candidates).map((m) => m.id)).toEqual([
      "gpt-5.4",
      "gpt-5.5",
      "gpt-5.6",
      "gpt-6-astra",
    ]);
    const mapping = {
      ...deriveHRouterModelMapping("codex", candidates),
      primary: "gpt-5.6-luna",
    };
    const settings = buildHRouterSettingsConfig(
      "codex",
      "test",
      mapping,
      candidates,
    ) as {
      modelCatalog: {
        models: Array<{
          model: string;
          supportedReasoningEfforts: string[];
          preferCodexReasoningMetadata: boolean;
        }>;
      };
    };
    expect(settings.modelCatalog.models.map((m) => m.model)).toEqual([
      "gpt-5.6-luna",
      "gpt-5.4",
      "gpt-5.5",
      "gpt-6-astra",
    ]);
    expect(settings.modelCatalog.models[0].supportedReasoningEfforts).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    expect(settings.modelCatalog.models[3].supportedReasoningEfforts).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
      "ultra",
    ]);
    expect(settings.modelCatalog.models[1].supportedReasoningEfforts).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(settings.modelCatalog.models[0].preferCodexReasoningMetadata).toBe(
      true,
    );
  });

  it("does not invent model IDs or fall back to the full unrelated list", () => {
    expect(
      getHRouterCodexModels([
        { id: "gpt-4o-audio-preview", ownedBy: "openai" },
      ]),
    ).toEqual([]);
    expect(
      deriveHRouterModelMapping("codex", [
        { id: "gpt-image-2", ownedBy: "openai" },
      ]).primary,
    ).toBe("");
  });

  it("round-trips editable model mappings without replacing them with family defaults", () => {
    const rows = [
      {
        model: " team/my-custom-route ",
        displayName: " GPT 6 ",
        contextWindow: 64000,
        supportedReasoningEfforts: ["low", "high"],
        defaultReasoningEffort: "low",
        preferCodexReasoningMetadata: false,
      },
    ];
    const saved = buildHRouterSettingsConfig(
      "codex",
      "test",
      {
        primary: "team/my-custom-route",
        haiku: "",
        sonnet: "",
        opus: "",
      },
      models,
      undefined,
      rows,
    );
    const restored = getHRouterCodexCatalog(saved)!;
    expect(restored).toEqual([
      { ...rows[0], model: "team/my-custom-route", displayName: "GPT 6" },
    ]);
    expect(
      buildHRouterCodexCatalog("team/my-custom-route", [], restored),
    ).toEqual(restored);
  });

  it("keeps the default model but does not re-add deleted mappings", () => {
    expect(
      buildHRouterCodexCatalog("my-default", models, []).map(
        (row) => row.model,
      ),
    ).toEqual(["my-default"]);
    expect(
      buildHRouterCodexCatalog("same", models, [
        { model: " same " },
        { model: "same" },
      ]),
    ).toHaveLength(1);
    expect(getHRouterCodexCatalog({ modelCatalog: { models: [] } })).toEqual(
      [],
    );
    expect(getHRouterCodexCatalog({})).toBeUndefined();
  });

  it("supports optional Goal mode and disabling remote compaction", () => {
    const mapping = deriveHRouterModelMapping("codex", models);
    const settingsConfig = buildHRouterSettingsConfig(
      "codex",
      "sk-hrouter-test",
      mapping,
      models,
      {
        contextWindow: HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW,
        autoCompactTokenLimit: HROUTER_CODEX_DEFAULT_AUTO_COMPACT_TOKEN_LIMIT,
        goalMode: true,
        remoteCompaction: false,
      },
    ) as { config: string };

    expect(settingsConfig.config).toContain("[features]\ngoals = true");
    expect(settingsConfig.config).toContain('name = "HRouter"');
  });

  it("normalizes a saved HRouter Codex provider id without changing custom config", () => {
    const savedConfig = `model = "gpt-5.6-sol"
model_provider = "legacy-route" # keep this comment

[model_providers.legacy-route]
name = "HRouter"
base_url = "https://hrouter.net/v1"

[custom_section]
keep_me = "preserved"
`;

    const normalized = normalizeHRouterCodexProviderId(savedConfig);

    expect(normalized).toContain(
      'model_provider = "hrouter" # keep this comment',
    );
    expect(normalized).toContain("[model_providers.hrouter]");
    expect(normalized).toContain('[custom_section]\nkeep_me = "preserved"');
    expect(normalized).not.toContain("legacy-route");
  });

  it("preserves custom Codex context settings when editing", () => {
    const mapping = deriveHRouterModelMapping("codex", models);
    const settingsConfig = buildHRouterSettingsConfig(
      "codex",
      "sk-existing",
      mapping,
      models,
      { contextWindow: 500_000, autoCompactTokenLimit: 420_000 },
    );
    const state = extractHRouterProviderState("codex", {
      id: "hrouter-codex",
      name: "HRouter",
      settingsConfig,
    });

    expect(state.apiKey).toBe("sk-existing");
    expect(state.mapping.primary).toBe(mapping.primary);
    expect(state.codexContextConfig).toEqual({
      contextWindow: 500_000,
      autoCompactTokenLimit: 420_000,
      goalMode: false,
      remoteCompaction: true,
    });
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

  it("marks Claude Desktop as a proxied HRouter route", () => {
    const mapping = deriveHRouterModelMapping("claude-desktop", models);
    const meta = buildHRouterProviderMeta(
      "claude-desktop",
      mapping,
      "sk-hrouter-test",
    );

    expect(meta.providerType).toBe("hrouter");
    expect(meta.claudeDesktopMode).toBe("proxy");
    expect(meta.claudeDesktopModelRoutes?.["claude-opus-5"]?.model).toBe(
      "claude-opus-5",
    );
    expect(meta.usage_script?.enabled).toBe(true);
  });

  it("automatically configures the HRouter usage endpoint", () => {
    const script = buildHRouterUsageScript(" sk-hrouter-test ");

    expect(script.apiKey).toBe("sk-hrouter-test");
    expect(script.baseUrl).toBe(HROUTER_ORIGIN);
    expect(script.code).toContain("/v1/usage?days=30");
    expect(script.code).toContain('billingMode = "payg"');
    expect(script.code).toContain("response.subscription");
  });

  it("maps subscription usage to total, used, and remaining quota", () => {
    const script = buildHRouterUsageScript("sk-hrouter-test");
    const config = Function(`"use strict"; return ${script.code};`)() as {
      extractor: (response: Record<string, unknown>) => Record<string, unknown>;
    };
    const result = config.extractor({
      mode: "unrestricted",
      isValid: true,
      planName: "Pro 月度订阅",
      unit: "USD",
      subscription: {
        monthly_limit_usd: 100,
        monthly_usage_usd: 27.5,
      },
      usage: { total: { actual_cost: 27.5 } },
      model_stats: [{ model: "gpt-5.6", requests: 8, actual_cost: 3.2 }],
    });

    expect(result).toMatchObject({
      planName: "Pro 月度订阅",
      total: 100,
      used: 27.5,
      remaining: 72.5,
      unit: "CNY",
    });
    expect(JSON.parse(result.extra as string)).toMatchObject({
      billingMode: "subscription",
      period: "月",
      modelStats: [{ model: "gpt-5.6", requests: 8, actual_cost: 3.2 }],
    });
  });

  it("maps pay-as-you-go usage to cumulative spend and wallet balance", () => {
    const script = buildHRouterUsageScript("sk-hrouter-test");
    const config = Function(`"use strict"; return ${script.code};`)() as {
      extractor: (response: Record<string, unknown>) => Record<string, unknown>;
    };
    const result = config.extractor({
      mode: "unrestricted",
      isValid: true,
      planName: "钱包余额",
      balance: 45.25,
      unit: "USD",
      usage: { total: { actual_cost: 12.75 } },
      model_stats: [],
    });

    expect(result).toMatchObject({
      planName: "按量计费",
      used: 12.75,
      remaining: 45.25,
      unit: "CNY",
    });
    expect(JSON.parse(result.extra as string)).toMatchObject({
      billingMode: "payg",
      balance: 45.25,
      totalActualCost: 12.75,
    });
  });

  it("restores the Key and editable model mapping from an existing provider", () => {
    const mapping = deriveHRouterModelMapping("claude", models);
    const settingsConfig = buildHRouterSettingsConfig(
      "claude",
      "sk-existing",
      mapping,
      models,
    );
    const state = extractHRouterProviderState("claude", {
      id: "hrouter",
      name: "HRouter",
      settingsConfig,
    });

    expect(state.apiKey).toBe("sk-existing");
    expect(state.mapping).toEqual(mapping);
  });
});
