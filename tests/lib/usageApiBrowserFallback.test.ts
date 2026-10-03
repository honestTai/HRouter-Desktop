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

  it("skips desktop-only pricing persistence in browser preview", async () => {
    await expect(usageApi.getModelPricing()).resolves.toEqual([]);
    await expect(usageApi.updateModelPricingBatch([])).resolves.toBe(0);
    expect(invoke).not.toHaveBeenCalled();
  });
});
