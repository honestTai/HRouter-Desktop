import { expect, it } from "vitest";
import { sumIndependentQuotas } from "@/components/access/QuotaSummary";
it("never mixes currencies or treats missing/error quotas as zero", () => {
  expect(
    sumIndependentQuotas([
      {
        success: true,
        data: [
          { remaining: 3, unit: "USD" },
          { remaining: 4, unit: "CNY" },
        ],
      },
      {
        success: true,
        data: [
          { remaining: 2, unit: "USD" },
          { remaining: 9 },
          { remaining: Infinity, unit: "USD" },
        ],
      },
      { success: false, error: "timeout" },
    ]),
  ).toEqual({ totals: { USD: 5, CNY: 4 }, missing: 3 });
});
