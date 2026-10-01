import { parse } from "smol-toml";

/** Configured model IDs only — not a remote catalog count or availability claim. */
export function configuredModels(settings: unknown): string[] {
  if (!settings || typeof settings !== "object") return [];
  const config = settings as Record<string, unknown>;
  const names = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) names.add(value.trim());
  };
  const readModels = (value: unknown) => {
    if (Array.isArray(value))
      value.forEach((item) =>
        typeof item === "string" ? add(item) : add(item?.id),
      );
    else if (value && typeof value === "object")
      Object.keys(value).forEach(add);
  };
  readModels(config.models);
  add(config.model);
  if (config.env && typeof config.env === "object") {
    const env = config.env as Record<string, unknown>;
    [
      "ANTHROPIC_MODEL",
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
      "ANTHROPIC_SMALL_FAST_MODEL",
      "GEMINI_MODEL",
    ].forEach((key) => add(env[key]));
  }
  if (typeof config.config === "string") {
    try {
      add(parse(config.config).model);
    } catch {
      /* Invalid TOML is handled by the configuration editor. */
    }
  }
  return [...names];
}
