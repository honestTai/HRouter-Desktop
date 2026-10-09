import { describe, expect, it } from "vitest";
import { buildHRouterProviderMeta, deriveHRouterModelMapping } from "./hrouter";
import {
  buildHRouterDesktopRoutes,
  buildHRouterDesktopRouteMap,
  getHRouterDesktopRoutes,
  mappingFromHRouterDesktopRoutes,
  validateHRouterDesktopRoutes,
} from "./hrouterClaudeDesktop";

const mapping = {
  primary: "claude-fable-5-1",
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-4-6",
};

describe("HRouter Claude Desktop routes", () => {
  it("recommends the newest numeric version per role regardless of API order", () => {
    const ids = [
      "claude-opus-4-6",
      "claude-opus-5",
      "claude-opus-5-5",
      "claude-haiku-4-5-20251001",
      "claude-haiku-5-5",
      "claude-sonnet-5-5",
      "claude-sonnet-5-10",
      "claude-sonnet-5-20261001",
    ];
    for (const app of ["claude", "claude-desktop"] as const) {
      for (const order of [ids, [...ids].reverse()]) {
        expect(
          deriveHRouterModelMapping(
            app,
            order.map((id) => ({ id, ownedBy: "anthropic" })),
          ),
        ).toEqual({
          primary: "claude-sonnet-5-10",
          sonnet: "claude-sonnet-5-10",
          opus: "claude-opus-5-5",
          haiku: "claude-haiku-5-5",
        });
      }
    }
  });

  it("compares namespaced versions and preserves the returned ID", () => {
    expect(
      deriveHRouterModelMapping("claude-desktop", [
        { id: "claude-opus-5", ownedBy: "anthropic" },
        { id: "anthropic/claude-opus-5-5", ownedBy: "anthropic" },
      ]).opus,
    ).toBe("anthropic/claude-opus-5-5");
  });

  it("uses exact native IDs and includes a distinct primary model", () => {
    const meta = buildHRouterProviderMeta("claude-desktop", mapping, "test");
    expect(Object.keys(meta.claudeDesktopModelRoutes!)).toEqual([
      "claude-sonnet-5-5",
      "claude-opus-4-6",
      "claude-haiku-5-5",
      "claude-fable-5-1",
    ]);
    for (const [id, route] of Object.entries(meta.claudeDesktopModelRoutes!))
      expect(route.model).toBe(id);
    expect(meta.claudeDesktopModelRoutes).not.toHaveProperty(
      "claude-haiku-4-5",
    );
    expect(meta.claudeDesktopModelRoutes).not.toHaveProperty("claude-opus-5");
  });

  it("deduplicates identical upstreams and reserves native IDs before allocating alias routes", () => {
    const rows = buildHRouterDesktopRoutes({
      ...mapping,
      sonnet: "custom-alias",
      primary: "claude-sonnet-5",
      haiku: mapping.opus,
    });
    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.model === "custom-alias")?.routeId).toBe(
      "claude-sonnet-5-hrouter-2",
    );
    expect(rows.find((row) => row.model === "claude-sonnet-5")?.routeId).toBe(
      "claude-sonnet-5",
    );
    expect(validateHRouterDesktopRoutes(rows)).toBeUndefined();
  });

  it("round trips all manual routes, display labels and context flags without migration", () => {
    const saved = {
      claudeDesktopModelRoutes: {
        "claude-haiku-4-5": {
          model: "claude-haiku-5-5",
          labelOverride: "我的模型",
          supports1m: true,
        },
        "claude-sonnet-5-alt": {
          model: "custom-alias",
          labelOverride: "Alias",
          supports1m: false,
        },
      },
    };
    const rows = getHRouterDesktopRoutes(saved)!;
    expect(
      buildHRouterProviderMeta("claude-desktop", mapping, "test", rows)
        .claudeDesktopModelRoutes,
    ).toEqual(saved.claudeDesktopModelRoutes);
    expect(saved.claudeDesktopModelRoutes["claude-haiku-4-5"].model).toBe(
      "claude-haiku-5-5",
    );
  });

  it("normalizes input and synchronizes legacy env bindings with manually edited routes", () => {
    const rows = [
      {
        routeId: " claude-haiku-5-5 ",
        model: " custom-model ",
        labelOverride: " Custom ",
        supports1m: true,
      },
    ];
    expect(buildHRouterDesktopRouteMap(rows)).toEqual({
      "claude-haiku-5-5": {
        model: "custom-model",
        labelOverride: "Custom",
        supports1m: true,
      },
    });
    expect(mappingFromHRouterDesktopRoutes(mapping, rows)).toEqual({
      primary: "custom-model",
      haiku: "custom-model",
      sonnet: "custom-model",
      opus: "custom-model",
    });
  });

  it.each(["", "gpt-6", "claude-haiku-", "claude-haiku-5-5[1M]"])(
    "rejects invalid client ID %s",
    (routeId) => {
      expect(() =>
        buildHRouterDesktopRouteMap([{ routeId, model: "upstream" }]),
      ).toThrow("客户端模型 ID");
    },
  );

  it("rejects empty and duplicate route lists instead of silently dropping entries", () => {
    expect(() => buildHRouterDesktopRouteMap([])).toThrow("至少添加");
    expect(() =>
      buildHRouterDesktopRouteMap([{ routeId: "claude-sonnet-5", model: " " }]),
    ).toThrow("上游模型 ID");
    expect(() =>
      buildHRouterDesktopRouteMap([
        { routeId: "claude-sonnet-5", model: "a" },
        { routeId: " CLAUDE-SONNET-5 ", model: "b" },
      ]),
    ).toThrow("不能重复");
  });
});
