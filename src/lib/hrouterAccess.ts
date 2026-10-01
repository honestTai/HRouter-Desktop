import { parse as parseToml } from "smol-toml";
import type { AppId } from "@/lib/api";
import type { Provider } from "@/types";
import { extractHRouterProviderState } from "@/lib/hrouter";
import { parseGrokBuildConfig } from "@/utils/grokBuildConfig";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Check the actual configured endpoint, never a display name, website or stale preset tag. */
export function hasHRouterKey(app: AppId, provider: Provider): boolean {
  const config = record(provider.settingsConfig);
  let endpoint: unknown;
  switch (app) {
    case "claude":
    case "claude-desktop":
      endpoint = record(config.env).ANTHROPIC_BASE_URL;
      break;
    case "gemini":
      endpoint = record(config.env).GOOGLE_GEMINI_BASE_URL;
      break;
    case "codex":
      try {
        const toml = record(parseToml(String(config.config ?? "")));
        endpoint = record(
          record(toml.model_providers)[String(toml.model_provider)],
        ).base_url;
      } catch {
        return false;
      }
      break;
    case "grokbuild":
      endpoint = parseGrokBuildConfig(String(config.config ?? "")).baseUrl;
      break;
    case "opencode":
      endpoint = record(config.options).baseURL;
      break;
    case "hermes":
      endpoint = config.base_url;
      break;
    default:
      endpoint = config.baseUrl;
  }
  if (typeof endpoint !== "string") return false;
  try {
    const url = new URL(endpoint.trim());
    if (
      url.protocol !== "https:" ||
      !(url.hostname === "hrouter.net" || url.hostname.endsWith(".hrouter.net"))
    )
      return false;
  } catch {
    return false;
  }
  const key = extractHRouterProviderState(app, provider).apiKey.trim();
  // References/placeholders are not an installed literal key.
  return (
    !!key &&
    !/^(\$|\{|<)/.test(key) &&
    !("credentialMode" in config && config.credentialMode !== "literal")
  );
}
