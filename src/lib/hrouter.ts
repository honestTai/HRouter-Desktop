import type { AppId } from "@/lib/api";
import type { FetchedModel } from "@/lib/api/model-fetch";
import type { ProviderMeta } from "@/types";
import { CLAUDE_DESKTOP_ROLE_ROUTE_IDS } from "@/config/claudeDesktopProviderPresets";
import { buildGrokBuildConfig } from "@/utils/grokBuildConfig";

export const HROUTER_ORIGIN = "https://www.honesttai.com";
export const HROUTER_OPENAI_BASE_URL = `${HROUTER_ORIGIN}/v1`;
export const HROUTER_MODELS_URL = `${HROUTER_OPENAI_BASE_URL}/models`;
export const HROUTER_ICON_COLOR = "#10b981";

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

export function buildHRouterSettingsConfig(
  appId: AppId,
  apiKey: string,
  mapping: HRouterModelMapping,
  models: FetchedModel[],
): Record<string, unknown> {
  const key = apiKey.trim();
  const modelIds = uniqueModelIds(models);

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
      const config = `disable_response_storage = true
model = ${tomlString(mapping.primary)}
model_reasoning_effort = "high"
model_provider = "4router"
model_context_window = 1000000
model_auto_compact_token_limit = 900000

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
          modelIds.map((model) => [model, { name: model }]),
        ),
      };

    case "openclaw":
      return {
        baseUrl: HROUTER_OPENAI_BASE_URL,
        apiKey: key,
        api: "openai-responses",
        models: modelIds.map((model) => ({ id: model, name: model })),
      };

    case "hermes":
      return {
        name: "HRouter",
        base_url: HROUTER_OPENAI_BASE_URL,
        api_key: key,
        api_mode: mapping.primary.toLowerCase().includes("claude")
          ? "anthropic_messages"
          : "codex_responses",
        models: modelIds.map((model) => ({ id: model, name: model })),
      };
  }
}

export function buildHRouterProviderMeta(
  appId: AppId,
  mapping: HRouterModelMapping,
): ProviderMeta {
  const meta: ProviderMeta = {
    providerType: "hrouter",
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
