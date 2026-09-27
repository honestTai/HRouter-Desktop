import { describe, expect, it } from "vitest";
import { parse } from "smol-toml";
import {
  isCodexModelDiscoveryEnabled,
  setCodexModelDiscovery,
} from "@/utils/providerConfigUtils";

describe("Codex remote model discovery", () => {
  const config =
    '# local rules\nmodel_provider = "custom"\nmodel_catalog_json = "local.json"\n[features]\ngoals = true\n[model_providers.custom]\nbase_url = "https://relay.example/v1/"\n[mcp_servers.keep]\ncommand = "local"\n';
  it("writes both required settings and preserves local catalog, MCP and comments", () => {
    const enabled = setCodexModelDiscovery(config, true);
    const parsed = parse(enabled) as any;
    expect(isCodexModelDiscoveryEnabled(enabled)).toBe(true);
    expect(parsed.model_providers.custom.model_catalog_url).toBe(
      "https://relay.example/v1/models",
    );
    expect(parsed.model_catalog_json).toBe("local.json");
    expect(parsed.mcp_servers.keep.command).toBe("local");
    expect(enabled).toContain("# local rules");
    const disabled = parse(setCodexModelDiscovery(enabled, false)) as any;
    expect(disabled.features).toEqual({ goals: true });
    expect(disabled.model_providers.custom.model_catalog_url).toBeUndefined();
  });
  it("keeps custom catalog URLs and ignores official or malformed TOML", () => {
    const custom = config.replace(
      "[mcp_servers.keep]",
      'model_catalog_url = "https://relay.example/catalog"\n[mcp_servers.keep]',
    );
    expect(
      (parse(setCodexModelDiscovery(custom, true)) as any).model_providers
        .custom.model_catalog_url,
    ).toBe("https://relay.example/catalog");
    expect(setCodexModelDiscovery('model_provider = "openai"', true)).toBe(
      'model_provider = "openai"',
    );
    expect(setCodexModelDiscovery("broken = [", true)).toBe("broken = [");
  });
});
