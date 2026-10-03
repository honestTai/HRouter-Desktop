import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingConfigPanel } from "@/components/usage/PricingConfigPanel";
import type { ModelPricing } from "@/types/usage";

const localPricing = vi.hoisted(() => ({
  data: [] as ModelPricing[],
  isLoading: false,
  error: null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/query/usage", () => ({
  useModelPricing: () => localPricing,
}));
vi.mock("@/lib/api/proxy", () => ({
  proxyApi: {
    getDefaultCostMultiplier: vi.fn().mockResolvedValue("1"),
    getPricingModelSource: vi.fn().mockResolvedValue("response"),
    setDefaultCostMultiplier: vi.fn().mockResolvedValue(undefined),
    setPricingModelSource: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("PricingConfigPanel local pricing", () => {
  beforeEach(() => {
    localPricing.data = [];
    localPricing.isLoading = false;
  });

  it("shows the empty local state without a platform sync control", () => {
    render(<PricingConfigPanel />);
    expect(screen.getByText("usage.noPricingData")).toBeVisible();
    expect(screen.queryByText("usage.modelPlazaPricingTitle")).toBeNull();
    expect(screen.queryByRole("button", { name: "common.refresh" })).toBeNull();
  });

  it("renders the locally configured model prices", () => {
    localPricing.data = [
      {
        modelId: "example-model",
        displayName: "Example Model",
        inputCostPerMillion: "4",
        outputCostPerMillion: "20",
        cacheReadCostPerMillion: "0.631111",
        cacheCreationCostPerMillion: "2.777778",
      },
    ];
    render(<PricingConfigPanel />);
    expect(screen.getByText("Example Model")).toBeVisible();
    for (const price of ["4", "20", "0.631111", "2.777778"]) {
      expect(screen.getByText(`¥${price}`)).toBeVisible();
    }
  });
});
