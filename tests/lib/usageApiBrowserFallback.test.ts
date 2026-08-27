import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, isTauri } = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke, isTauri }));

import { usageApi } from "@/lib/api/usage";

describe("usageApi browser preview fallback", () => {
  beforeEach(() => {
    isTauri.mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("reads the public Model Plaza through the development proxy", async () => {
    const payload = { code: 0, data: { display_currency: "CNY" } };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn(async () => payload),
    } as unknown as Response);

    await expect(usageApi.fetchHRouterModelPlaza()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith("/hrouter-api/v1/model-plaza", {
      headers: { Accept: "application/json" },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("skips desktop-only pricing persistence in browser preview", async () => {
    await expect(usageApi.getModelPricing()).resolves.toEqual([]);
    await expect(usageApi.updateModelPricingBatch([])).resolves.toBe(0);
    expect(invoke).not.toHaveBeenCalled();
  });
});
