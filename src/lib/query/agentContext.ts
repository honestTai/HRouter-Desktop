import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { AppId } from "@/lib/api/types";

/** One Agent's configuration appears in several pages; refresh them as one scope. */
export async function invalidateAgentContext(client: QueryClient, app: AppId) {
  const keys: QueryKey[] = [
    ["providers", app],
    ["agent-access", app],
    ["profile-preview", app],
    ["direct-routes", app],
    ["model-routes", app],
  ];
  if (app === "opencode")
    keys.push(
      ["opencodeLiveProviderIds"],
      ["opencode", "runtime-models"],
      ["omo"],
      ["omo-slim"],
    );
  if (app === "openclaw")
    keys.push(
      ["openclaw", "liveProviderIds"],
      ["openclaw", "defaultModel"],
      ["openclaw", "health"],
    );
  if (app === "hermes")
    keys.push(["hermes", "liveProviderIds"], ["hermes", "modelConfig"]);
  if (app === "claude-desktop") keys.push(["claudeDesktopStatus"]);
  await Promise.all(
    keys.map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}

/** Multi-Agent imports/deployments do not expose a single scope. */
export async function invalidateAllAgentContexts(client: QueryClient) {
  const roots = [
    "providers",
    "agent-access",
    "profile-preview",
    "direct-routes",
    "model-routes",
    "opencodeLiveProviderIds",
    "opencode",
    "omo",
    "omo-slim",
    "openclaw",
    "hermes",
    "claudeDesktopStatus",
  ];
  await Promise.all(
    roots.map((root) => client.invalidateQueries({ queryKey: [root] })),
  );
}
