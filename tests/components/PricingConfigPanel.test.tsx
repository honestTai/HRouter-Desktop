import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingConfigPanel } from "@/components/usage/PricingConfigPanel";

const { syncHRouterModelPlazaPricing, access } = vi.hoisted(() => ({
  access: { connected: true },
  syncHRouterModelPlazaPricing: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/hrouterModelPlazaPricing", () => ({
  HROUTER_MODEL_PLAZA_QUERY_KEY: ["hrouter-model-plaza-pricing"],
  syncHRouterModelPlazaPricing,
}));

vi.mock("@/lib/query/usage", () => ({
  useModelPricing: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("@/lib/api/proxy", () => ({
  proxyApi: {
    getDefaultCostMultiplier: vi.fn().mockResolvedValue("1"),
    getPricingModelSource: vi.fn().mockResolvedValue("response"),
    setDefaultCostMultiplier: vi.fn().mockResolvedValue(undefined),
    setPricingModelSource: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/hooks/useHRouterAccess", () => ({ useHRouterAccess: () => access }));

describe("PricingConfigPanel Model Plaza source", () => {
  beforeEach(() => {
    access.connected = true;
    syncHRouterModelPlazaPricing.mockClear();
  });
  it("does not fetch or display HRouter pricing without a configured key", () => {
    access.connected = false;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <PricingConfigPanel />
      </QueryClientProvider>,
    );
    expect(screen.queryByText("usage.modelPlazaPricingTitle")).toBeNull();
    expect(syncHRouterModelPlazaPricing).not.toHaveBeenCalled();
  });
  it("renders synchronized Model Plaza prices in Chinese yuan", async () => {
    syncHRouterModelPlazaPricing.mockResolvedValue({
      displayCurrency: "CNY",
      description: "人民币公开售价",
      changed: 1,
      pricing: [
        {
          modelId: "gpt-5.6-sol",
          displayName: "gpt-5.6-sol",
          inputCostPerMillion: "4",
          outputCostPerMillion: "20",
          cacheReadCostPerMillion: "0.631111",
          cacheCreationCostPerMillion: "2.777778",
        },
      ],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PricingConfigPanel />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("usage.modelPlazaPricingTitle"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("gpt-5.6-sol")).toHaveLength(2);
    expect(screen.getByText("¥4")).toBeInTheDocument();
    expect(screen.getByText("¥20")).toBeInTheDocument();
    expect(screen.getByText("¥0.631111")).toBeInTheDocument();
    expect(screen.getByText("¥2.777778")).toBeInTheDocument();
  });
});
