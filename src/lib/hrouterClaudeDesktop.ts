import { CLAUDE_DESKTOP_ROLE_ROUTE_IDS } from "@/config/claudeDesktopProviderPresets";
import type { ClaudeDesktopModelRoute, ProviderMeta } from "@/types";
import type { HRouterModelMapping } from "./hrouter";

export interface HRouterDesktopRoute extends ClaudeDesktopModelRoute {
  routeId: string;
}

// Mirror the backend profile validator. A valid ID is not a guarantee that the
// installed Claude version knows its capabilities, or that an upstream supports them.
export function isHRouterDesktopModelId(id: string): boolean {
  const normalized = id.trim().toLowerCase();
  return (
    !normalized.includes("[1m]") &&
    /^(?:anthropic\/)?claude-(sonnet|opus|haiku|fable)-.+$/.test(normalized)
  );
}

export function getHRouterDesktopRoutes(
  meta?: ProviderMeta,
): HRouterDesktopRoute[] | undefined {
  const entries = Object.entries(meta?.claudeDesktopModelRoutes ?? {});
  return entries.length
    ? entries.map(([routeId, route]) => ({ ...route, routeId }))
    : undefined;
}

export function buildHRouterDesktopRoutes(
  mapping: HRouterModelMapping,
): HRouterDesktopRoute[] {
  const entries = (["sonnet", "opus", "haiku", "primary"] as const)
    .map((role) => ({ role, model: mapping[role].trim() }))
    .filter(
      ({ model }, i, rows) =>
        model && rows.findIndex((row) => row.model === model) === i,
    );
  const reserved = new Set(
    entries
      .filter(({ model }) => isHRouterDesktopModelId(model))
      .map(({ model }) => model.toLowerCase()),
  );
  const used = new Set<string>();
  return entries.map(({ role, model }) => {
    let routeId = model;
    if (!isHRouterDesktopModelId(model)) {
      const base =
        CLAUDE_DESKTOP_ROLE_ROUTE_IDS[role === "primary" ? "sonnet" : role];
      routeId = base;
      let suffix = 2;
      while (
        reserved.has(routeId.toLowerCase()) ||
        used.has(routeId.toLowerCase())
      )
        routeId = `${base}-hrouter-${suffix++}`;
    }
    used.add(routeId.toLowerCase());
    return { routeId, model, labelOverride: model };
  });
}

export function validateHRouterDesktopRoutes(
  rows: HRouterDesktopRoute[],
): string | undefined {
  if (!rows.length) return "至少添加一条 Claude Desktop 模型映射";
  if (rows.some((row) => !row.model.trim()))
    return "请填写每条映射的上游模型 ID";
  if (rows.some((row) => !isHRouterDesktopModelId(row.routeId)))
    return "客户端模型 ID 必须是 claude-sonnet-*、claude-opus-*、claude-haiku-* 或 claude-fable-*（可带 anthropic/ 前缀，不含 [1M]）";
  if (
    new Set(rows.map((row) => row.routeId.trim().toLowerCase())).size !==
    rows.length
  )
    return "客户端模型 ID 不能重复";
}

export function buildHRouterDesktopRouteMap(
  rows: HRouterDesktopRoute[],
): Record<string, ClaudeDesktopModelRoute> {
  const error = validateHRouterDesktopRoutes(rows);
  if (error) throw new Error(error);
  return Object.fromEntries(
    rows.map(({ routeId, model, labelOverride, ...rest }) => [
      routeId.trim(),
      {
        ...rest,
        model: model.trim(),
        ...(labelOverride?.trim()
          ? { labelOverride: labelOverride.trim() }
          : {}),
      },
    ]),
  );
}

// Keep the legacy env role bindings consistent with the visible route editor.
export function mappingFromHRouterDesktopRoutes(
  mapping: HRouterModelMapping,
  rows: HRouterDesktopRoute[],
): HRouterModelMapping {
  const primary = rows.some(
    (row) => row.model.trim() === mapping.primary.trim(),
  )
    ? mapping.primary.trim()
    : (rows[0]?.model.trim() ?? "");
  const modelFor = (role: "haiku" | "sonnet" | "opus") =>
    rows
      .find((row) =>
        new RegExp(`^(?:anthropic/)?claude-${role}-`, "i").test(
          row.routeId.trim(),
        ),
      )
      ?.model.trim() || primary;
  return {
    primary,
    haiku: modelFor("haiku"),
    sonnet: modelFor("sonnet"),
    opus: modelFor("opus"),
  };
}
