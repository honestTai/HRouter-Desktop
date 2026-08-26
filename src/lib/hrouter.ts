import type { AppId } from "@/lib/api";
import type { FetchedModel } from "@/lib/api/model-fetch";
import type { Provider, ProviderMeta, UsageScript } from "@/types";
import { CLAUDE_DESKTOP_ROLE_ROUTE_IDS } from "@/config/claudeDesktopProviderPresets";
import {
  buildGrokBuildConfig,
  parseGrokBuildConfig,
} from "@/utils/grokBuildConfig";
import { extractCodexTopLevelInt } from "@/utils/providerConfigUtils";

export const HROUTER_ORIGIN = "https://hrouter.net";
export const HROUTER_OPENAI_BASE_URL = `${HROUTER_ORIGIN}/v1`;
export const HROUTER_MODELS_URL = `${HROUTER_OPENAI_BASE_URL}/models`;
export const HROUTER_ICON_COLOR = "#10b981";
export const HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW = 272_000;
export const HROUTER_CODEX_DEFAULT_AUTO_COMPACT_TOKEN_LIMIT = Math.floor(
  HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW * 0.9,
);

export const HROUTER_APP_NAMES: Record<AppId, string> = {
  claude: "Claude Code",
  "claude-desktop": "Claude Desktop",
  codex: "Codex",
  gemini: "Gemini CLI",
  grokbuild: "Grok Build",
  opencode: "OpenCode",
  openclaw: "OpenClaw",
  hermes: "Hermes",
};

export interface HRouterModelMapping {
  primary: string;
  haiku: string;
  sonnet: string;
  opus: string;
}

export interface HRouterCodexContextConfig {
  contextWindow: number;
  autoCompactTokenLimit: number;
}

export interface HRouterModelStat {
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  cost: number;
  actual_cost: number;
}

export interface HRouterUsageExtra {
  source: "hrouter";
  billingMode: "subscription" | "payg";
  planName?: string;
  period?: string;
  balance?: number;
  totalActualCost: number;
  modelStats: HRouterModelStat[];
}

export interface HRouterProviderState {
  apiKey: string;
  mapping: HRouterModelMapping;
  codexContextConfig: HRouterCodexContextConfig;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const firstNonEmpty = (...values: unknown[]): string =>
  values
    .map(asString)
    .find((value) => value.trim())
    ?.trim() ?? "";

const uniqueModelIds = (models: FetchedModel[]): string[] =>
  Array.from(
    new Set(
      models
        .map((model) => model.id.trim())
        .filter((model): model is string => Boolean(model)),
    ),
  );

const findByHints = (models: string[], hints: string[]): string | undefined =>
  hints.reduce<string | undefined>(
    (match, hint) =>
      match ??
      models.find((model) => model.toLowerCase().includes(hint.toLowerCase())),
    undefined,
  );

export function getHRouterModelsForApp(
  appId: AppId,
  models: FetchedModel[],
): FetchedModel[] {
  const predicates: Partial<Record<AppId, (id: string) => boolean>> = {
    claude: (id) => id.includes("claude") || id.includes("appclaude"),
    "claude-desktop": (id) => id.includes("claude") || id.includes("appclaude"),
    codex: (id) =>
      id.includes("gpt") || id.includes("codex") || id.includes("appcodex"),
    gemini: (id) => id.includes("gemini"),
    grokbuild: (id) => id.includes("grok"),
  };
  const predicate = predicates[appId];
  if (!predicate) return models;

  const compatible = models.filter((model) =>
    predicate(model.id.trim().toLowerCase()),
  );
  // HRouter may expose a custom alias which does not carry a vendor keyword.
  // Keep the full list available instead of incorrectly hiding valid routes.
  return compatible.length > 0 ? compatible : models;
}

export function deriveHRouterModelMapping(
  appId: AppId,
  models: FetchedModel[],
): HRouterModelMapping {
  const candidates = uniqueModelIds(getHRouterModelsForApp(appId, models));
  const allModels = uniqueModelIds(models);
  const pool = candidates.length > 0 ? candidates : allModels;

  const primaryHints: Partial<Record<AppId, string[]>> = {
    claude: ["sonnet", "appclaude", "opus", "claude"],
    "claude-desktop": ["sonnet", "appclaude", "opus", "claude"],
    codex: ["appcodex", "codex", "gpt"],
    gemini: ["gemini"],
    grokbuild: ["appcodex", "codex", "gpt", "claude", "gemini"],
  };
  const primary = findByHints(pool, primaryHints[appId] ?? []) ?? pool[0] ?? "";
  const sonnet = findByHints(allModels, ["claude-sonnet", "sonnet"]) ?? primary;
  const opus = findByHints(allModels, ["claude-opus", "opus"]) ?? sonnet;
  const haiku = findByHints(allModels, ["claude-haiku", "haiku"]) ?? sonnet;

  return { primary, haiku, sonnet, opus };
}

const tomlString = (value: string): string => JSON.stringify(value);

const asPositiveInteger = (
  value: number | undefined,
  fallback: number,
): number =>
  Number.isSafeInteger(value) && (value ?? 0) > 0
    ? (value as number)
    : fallback;

export function resolveHRouterCodexContextConfig(
  config?: Partial<HRouterCodexContextConfig>,
): HRouterCodexContextConfig {
  const contextWindow = asPositiveInteger(
    config?.contextWindow,
    HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW,
  );
  const defaultAutoCompactTokenLimit = Math.floor(contextWindow * 0.9);

  return {
    contextWindow,
    autoCompactTokenLimit: asPositiveInteger(
      config?.autoCompactTokenLimit,
      defaultAutoCompactTokenLimit,
    ),
  };
}

export function buildHRouterSettingsConfig(
  appId: AppId,
  apiKey: string,
  mapping: HRouterModelMapping,
  models: FetchedModel[],
  codexContextConfig?: Partial<HRouterCodexContextConfig>,
): Record<string, unknown> {
  const key = apiKey.trim();
  const modelIds = uniqueModelIds(models);
  const orderedModelIds = [
    mapping.primary,
    ...modelIds.filter((model) => model !== mapping.primary),
  ].filter(Boolean);

  switch (appId) {
    case "claude":
    case "claude-desktop":
      return {
        env: {
          ANTHROPIC_BASE_URL: HROUTER_ORIGIN,
          ANTHROPIC_AUTH_TOKEN: key,
          ANTHROPIC_MODEL: mapping.primary,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: mapping.haiku,
          ANTHROPIC_DEFAULT_SONNET_MODEL: mapping.sonnet,
          ANTHROPIC_DEFAULT_OPUS_MODEL: mapping.opus,
          ...(appId === "claude"
            ? { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" }
            : {}),
        },
      };

    case "codex": {
      const { contextWindow, autoCompactTokenLimit } =
        resolveHRouterCodexContextConfig(codexContextConfig);
      const config = `disable_response_storage = true
model = ${tomlString(mapping.primary)}
model_reasoning_effort = "high"
model_provider = "4router"
model_context_window = ${contextWindow}
model_auto_compact_token_limit = ${autoCompactTokenLimit}

[model_providers.4router]
name = "OpenAI"
base_url = ${tomlString(HROUTER_OPENAI_BASE_URL)}
requires_openai_auth = true
wire_api = "responses"
`;
      return { auth: { OPENAI_API_KEY: key }, config };
    }

    case "gemini":
      return {
        env: {
          GOOGLE_GEMINI_BASE_URL: HROUTER_ORIGIN,
          GEMINI_API_KEY: key,
          GEMINI_MODEL: mapping.primary,
        },
      };

    case "grokbuild":
      return {
        config: buildGrokBuildConfig({
          model: mapping.primary,
          upstreamModel: mapping.primary,
          baseUrl: HROUTER_OPENAI_BASE_URL,
          name: "HRouter",
          apiKey: key,
          apiBackend: "responses",
          contextWindow: 1_000_000,
        }),
      };

    case "opencode":
      return {
        npm: "@ai-sdk/openai-compatible",
        name: "HRouter",
        options: {
          baseURL: HROUTER_OPENAI_BASE_URL,
          apiKey: key,
          setCacheKey: true,
        },
        models: Object.fromEntries(
          orderedModelIds.map((model) => [model, { name: model }]),
        ),
      };

    case "openclaw":
      return {
        baseUrl: HROUTER_OPENAI_BASE_URL,
        apiKey: key,
        api: "openai-responses",
        models: orderedModelIds.map((model) => ({ id: model, name: model })),
      };

    case "hermes":
      return {
        name: "HRouter",
        base_url: HROUTER_OPENAI_BASE_URL,
        api_key: key,
        api_mode: mapping.primary.toLowerCase().includes("claude")
          ? "anthropic_messages"
          : "codex_responses",
        models: orderedModelIds.map((model) => ({ id: model, name: model })),
      };
  }
}

const HROUTER_USAGE_SCRIPT_CODE = `({
  request: {
    url: "{{baseUrl}}/v1/usage?days=30",
    method: "GET",
    headers: {
      "Authorization": "Bearer {{apiKey}}",
      "Accept": "application/json",
      "User-Agent": "HRouter-Desktop/1.0"
    }
  },
  extractor: function(response) {
    var usageTotal = response && response.usage && response.usage.total
      ? response.usage.total
      : {};
    var stats = Array.isArray(response && response.model_stats)
      ? response.model_stats
      : [];
    var modelStats = stats.map(function(item) {
      return {
        model: String(item.model || "unknown"),
        requests: Number(item.requests || 0),
        input_tokens: Number(item.input_tokens || 0),
        output_tokens: Number(item.output_tokens || 0),
        cache_creation_tokens: Number(item.cache_creation_tokens || 0),
        cache_read_tokens: Number(item.cache_read_tokens || 0),
        total_tokens: Number(item.total_tokens || 0),
        cost: Number(item.cost || 0),
        actual_cost: Number(item.actual_cost || 0)
      };
    });
    var totalActualCost = Number(usageTotal.actual_cost || 0);
    var baseExtra = {
      source: "hrouter",
      planName: response.planName || "",
      totalActualCost: totalActualCost,
      modelStats: modelStats
    };

    if (response.mode === "quota_limited" && response.quota) {
      baseExtra.billingMode = "subscription";
      baseExtra.period = "总额度";
      return {
        planName: response.planName || "订阅额度",
        isValid: response.isValid !== false,
        total: Number(response.quota.limit || 0),
        used: Number(response.quota.used || 0),
        remaining: Number(response.quota.remaining || 0),
        unit: response.quota.unit || "USD",
        extra: JSON.stringify(baseExtra)
      };
    }

    if (response.mode === "quota_limited" && Array.isArray(response.rate_limits) && response.rate_limits.length) {
      var priority = { "7d": 3, "1d": 2, "5h": 1 };
      var rate = response.rate_limits.slice().sort(function(a, b) {
        return (priority[b.window] || 0) - (priority[a.window] || 0);
      })[0];
      baseExtra.billingMode = "subscription";
      baseExtra.period = rate.window || "额度";
      return {
        planName: response.planName || "订阅额度",
        isValid: response.isValid !== false,
        total: Number(rate.limit || 0),
        used: Number(rate.used || 0),
        remaining: Number(rate.remaining || 0),
        unit: response.unit || "USD",
        extra: JSON.stringify(baseExtra)
      };
    }

    if (response.subscription) {
      var sub = response.subscription;
      var candidates = [
        { period: "月", limit: sub.monthly_limit_usd, used: sub.monthly_usage_usd },
        { period: "周", limit: sub.weekly_limit_usd, used: sub.weekly_usage_usd },
        { period: "日", limit: sub.daily_limit_usd, used: sub.daily_usage_usd }
      ];
      var selected = null;
      for (var i = 0; i < candidates.length; i += 1) {
        if (Number(candidates[i].limit || 0) > 0) {
          selected = candidates[i];
          break;
        }
      }
      baseExtra.billingMode = "subscription";
      baseExtra.period = selected ? selected.period : "订阅";
      var result = {
        planName: response.planName || "订阅套餐",
        isValid: response.isValid !== false,
        used: selected ? Number(selected.used || 0) : totalActualCost,
        unit: response.unit || "USD",
        extra: JSON.stringify(baseExtra)
      };
      if (selected) {
        result.total = Number(selected.limit || 0);
        result.remaining = Math.max(0, result.total - result.used);
      }
      return result;
    }

    baseExtra.billingMode = "payg";
    baseExtra.balance = Number(response.balance || response.remaining || 0);
    return {
      planName: "按量计费",
      isValid: response.isValid !== false,
      used: totalActualCost,
      remaining: baseExtra.balance,
      unit: response.unit || "USD",
      extra: JSON.stringify(baseExtra)
    };
  }
})`;

export function buildHRouterUsageScript(apiKey: string): UsageScript {
  return {
    enabled: true,
    language: "javascript",
    code: HROUTER_USAGE_SCRIPT_CODE,
    timeout: 15,
    templateType: "custom",
    apiKey: apiKey.trim(),
    baseUrl: HROUTER_ORIGIN,
    autoQueryInterval: 5,
  };
}

export function parseHRouterUsageExtra(
  extra: string | undefined,
): HRouterUsageExtra | null {
  if (!extra?.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(extra) as Partial<HRouterUsageExtra>;
    if (
      parsed.source !== "hrouter" ||
      (parsed.billingMode !== "subscription" && parsed.billingMode !== "payg")
    ) {
      return null;
    }
    return {
      source: "hrouter",
      billingMode: parsed.billingMode,
      planName: parsed.planName,
      period: parsed.period,
      balance: typeof parsed.balance === "number" ? parsed.balance : undefined,
      totalActualCost:
        typeof parsed.totalActualCost === "number" ? parsed.totalActualCost : 0,
      modelStats: Array.isArray(parsed.modelStats) ? parsed.modelStats : [],
    };
  } catch {
    return null;
  }
}

export function extractHRouterProviderState(
  appId: AppId,
  provider: Provider,
): HRouterProviderState {
  const config = asRecord(provider.settingsConfig) ?? {};
  const env = asRecord(config.env) ?? {};
  const auth = asRecord(config.auth) ?? {};
  const options = asRecord(config.options) ?? {};
  const modelMap = asRecord(config.models) ?? {};

  let apiKey = "";
  let primary = "";
  let haiku = "";
  let sonnet = "";
  let opus = "";
  let codexContextConfig = resolveHRouterCodexContextConfig();

  switch (appId) {
    case "claude":
    case "claude-desktop":
      apiKey = firstNonEmpty(env.ANTHROPIC_AUTH_TOKEN, env.ANTHROPIC_API_KEY);
      primary = asString(env.ANTHROPIC_MODEL);
      haiku = asString(env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
      sonnet = asString(env.ANTHROPIC_DEFAULT_SONNET_MODEL);
      opus = asString(env.ANTHROPIC_DEFAULT_OPUS_MODEL);
      break;
    case "codex": {
      apiKey = asString(auth.OPENAI_API_KEY);
      const toml = asString(config.config);
      primary = toml.match(/^model\s*=\s*["']([^"']+)["']/m)?.[1] ?? "";
      codexContextConfig = resolveHRouterCodexContextConfig({
        contextWindow: extractCodexTopLevelInt(toml, "model_context_window"),
        autoCompactTokenLimit: extractCodexTopLevelInt(
          toml,
          "model_auto_compact_token_limit",
        ),
      });
      break;
    }
    case "gemini":
      apiKey = asString(env.GEMINI_API_KEY);
      primary = asString(env.GEMINI_MODEL);
      break;
    case "grokbuild": {
      const parsed = parseGrokBuildConfig(
        asString(config.config),
        provider.name,
      );
      apiKey = parsed.apiKey;
      primary = parsed.upstreamModel || parsed.model;
      break;
    }
    case "opencode":
      apiKey = asString(options.apiKey);
      primary = Object.keys(modelMap)[0] ?? "";
      break;
    case "openclaw": {
      apiKey = asString(config.apiKey);
      const models = Array.isArray(config.models) ? config.models : [];
      primary = asString(asRecord(models[0])?.id);
      break;
    }
    case "hermes": {
      apiKey = asString(config.api_key);
      const models = Array.isArray(config.models) ? config.models : [];
      primary = asString(asRecord(models[0])?.id);
      break;
    }
  }

  const fallback = primary || sonnet || opus || haiku;
  return {
    apiKey,
    mapping: {
      primary: fallback,
      haiku: haiku || fallback,
      sonnet: sonnet || fallback,
      opus: opus || fallback,
    },
    codexContextConfig,
  };
}

export function buildHRouterProviderMeta(
  appId: AppId,
  mapping: HRouterModelMapping,
  apiKey: string,
): ProviderMeta {
  const meta: ProviderMeta = {
    providerType: "hrouter",
    usage_script: buildHRouterUsageScript(apiKey),
    apiFormat:
      appId === "claude" || appId === "claude-desktop"
        ? "anthropic"
        : appId === "codex" || appId === "grokbuild"
          ? "openai_responses"
          : undefined,
  };

  if (appId === "claude-desktop") {
    meta.claudeDesktopMode = "direct";
    meta.claudeDesktopModelRoutes = {
      [CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet]: {
        model: mapping.sonnet,
        labelOverride: mapping.sonnet,
      },
      [CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus]: {
        model: mapping.opus,
        labelOverride: mapping.opus,
      },
      [CLAUDE_DESKTOP_ROLE_ROUTE_IDS.haiku]: {
        model: mapping.haiku,
        labelOverride: mapping.haiku,
      },
    };
  }

  return meta;
}
