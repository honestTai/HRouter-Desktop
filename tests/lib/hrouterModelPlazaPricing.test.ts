import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchHRouterModelPlaza, updateModelPricingBatch } = vi.hoisted(() => ({
  fetchHRouterModelPlaza: vi.fn(),
  updateModelPricingBatch: vi.fn(),
}));

vi.mock("@/lib/api/usage", () => ({
  usageApi: { fetchHRouterModelPlaza, updateModelPricingBatch },
}));

import {
  parseHRouterModelPlazaPricing,
  syncHRouterModelPlazaPricing,
} from "@/lib/hrouterModelPlazaPricing";

const plazaResponse = {
  code: 0,
  message: "success",
  data: {
    display_currency: "CNY",
    description: "人民币公开售价",
    groups: [
      {
        plaza_status: "coming_soon",
        purchasable: false,
        models: [
          {
            name: "gpt-5.6-sol",
            pricing: {
              billing_mode: "token",
              input_price: 0.000009,
              output_price: 0.000009,
            },
          },
        ],
      },
      {
        plaza_status: "live",
        purchasable: true,
        models: [
          {
            name: "gpt-5.6-sol",
            pricing: {
              billing_mode: "token",
              input_price: 0.000004,
              output_price: 0.00002,
              cache_write_price: 0.000002777778,
              cache_read_price: 0.000000631111,
            },
          },
          {
            name: "image-request-model",
            pricing: {
              billing_mode: "request",
              input_price: 1,
              output_price: 1,
            },
          },
        ],
      },
    ],
  },
};

describe("HRouter Model Plaza pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchHRouterModelPlaza.mockResolvedValue(plazaResponse);
    updateModelPricingBatch.mockResolvedValue(1);
  });

  it("converts active CNY token prices to per-million values", () => {
    const result = parseHRouterModelPlazaPricing(plazaResponse);

    expect(result.displayCurrency).toBe("CNY");
    expect(result.pricing).toEqual([
      {
        modelId: "gpt-5.6-sol",
        displayName: "gpt-5.6-sol",
        inputCostPerMillion: "4",
        outputCostPerMillion: "20",
        cacheReadCostPerMillion: "0.631111",
        cacheCreationCostPerMillion: "2.777778",
      },
    ]);
  });

  it("rejects a non-CNY price feed", () => {
    expect(() =>
      parseHRouterModelPlazaPricing({
        ...plazaResponse,
        data: { ...plazaResponse.data, display_currency: "USD" },
      }),
    ).toThrow("不是人民币计价");
  });

  it("writes the fetched plaza prices to the local billing engine", async () => {
    const result = await syncHRouterModelPlazaPricing();

    expect(updateModelPricingBatch).toHaveBeenCalledTimes(1);
    expect(updateModelPricingBatch).toHaveBeenCalledWith(result.pricing);
    expect(result.changed).toBe(1);
  });
});
