import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UsageFooter from "@/components/UsageFooter";
import type { Provider } from "@/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/query/queries", () => ({
  useUsageQuery: () => ({
    data: {
      success: true,
      data: [
        {
          remaining: 711.58,
          unit: "CNY",
          extra: JSON.stringify({
            source: "hrouter",
            billingMode: "payg",
            totalActualCost: 403.38,
            modelStats: [
              {
                model: "gpt-5.6-sol",
                requests: 4452,
                input_tokens: 34282457,
                output_tokens: 2309645,
                total_tokens: 936943718,
                actual_cost: 399.02,
              },
            ],
          }),
        },
      ],
    },
    isFetching: false,
    isError: false,
    lastQueriedAt: null,
    refetch: vi.fn(),
  }),
}));

describe("UsageFooter HRouter currency", () => {
  it("renders pay-as-you-go usage amounts in Chinese yuan", () => {
    const provider: Provider = {
      id: "hrouter",
      name: "HRouter",
      settingsConfig: {},
      meta: { providerType: "hrouter" },
    };

    render(
      <UsageFooter
        provider={provider}
        providerId={provider.id}
        appId="codex"
        usageEnabled
        isCurrent
      />,
    );

    expect(screen.getByText("¥403.38")).toBeInTheDocument();
    expect(screen.getByText("¥711.58")).toBeInTheDocument();
    expect(screen.getByText("¥399.02")).toBeInTheDocument();
    expect(screen.queryByText("$403.38")).not.toBeInTheDocument();
  });
});
