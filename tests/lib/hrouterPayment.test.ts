import { describe, expect, it } from "vitest";
import {
  isPaymentPending,
  safePaymentUrl,
  validRecharge,
  rechargePreview,
  rechargeRebateRate,
  visiblePaymentMethods,
} from "@/lib/hrouterPayment";
import type { HRouterCheckoutInfo } from "@/lib/api/hrouterPlatform";
const checkout: HRouterCheckoutInfo = {
  methods: {
    alipay: { single_min: 10, single_max: 100, fee_rate: 0, available: true },
  },
  global_min: 5,
  global_max: 80,
  balance_disabled: false,
  balance_recharge_multiplier: 1,
  recharge_fee_rate: 0,
};
describe("HRouter payment contract", () => {
  it("requires an enabled method, positive amount and both global and method bounds", () => {
    expect(validRecharge(50, "alipay", checkout)).toBe(true);
    for (const n of [0, -1, 9, 81, 101, Infinity, NaN])
      expect(validRecharge(n, "alipay", checkout)).toBe(false);
    expect(validRecharge(50, "missing", checkout)).toBe(false);
    expect(
      validRecharge(50, "alipay", { ...checkout, balance_disabled: true }),
    ).toBe(false);
    expect(validRecharge(50, "alipay", undefined)).toBe(false);
  });
  it("does not equate PAID with balance credited", () => {
    for (const s of [undefined, "PENDING", "PAID", "RECHARGING"])
      expect(isPaymentPending(s)).toBe(true);
    for (const s of ["COMPLETED", "CANCELLED", "EXPIRED", "FAILED", "REFUNDED"])
      expect(isPaymentPending(s)).toBe(false);
  });
  it("never opens arbitrary protocols returned as a checkout URL", () => {
    for (const s of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "http://pay.example.com",
      "https://user:password@pay.example.com",
      "not a URL",
    ])
      expect(safePaymentUrl(s)).toBeNull();
    expect(safePaymentUrl("https://pay.example.com/order/1")).toBe(
      "https://pay.example.com/order/1",
    );
  });
});

describe("latest sub2api wallet parity (08d8bae54)", () => {
  it("uses percentage rebates multiplied by base credit rate", () => {
    const config = {
      ...checkout,
      balance_recharge_multiplier: 2,
      recharge_rebate_enabled: true,
      recharge_rebate_rate: 5,
      recharge_fee_rate: 1.6,
    };
    expect(rechargePreview(100, config)).toEqual({
      feeRate: 1.6,
      fee: 1.6,
      total: 101.6,
      credited: 210,
      multiplier: 2.1,
    });
    expect(rechargePreview(10, config).total).toBe(10.16);
  });
  it("matches exclusive tier upper bounds and a maximum 10 percent rebate", () => {
    const config = {
      ...checkout,
      recharge_rebate_tiers: [
        { min_amount: 0, max_amount: 100, rate: 5 },
        { min_amount: 100, rate: 12 },
      ],
    };
    expect(rechargeRebateRate(config, 99.99)).toBe(5);
    expect(rechargeRebateRate(config, 100)).toBe(10);
  });
  it("ceil-rounds fees, permits a fractional positive multiplier and does not invent credit", () => {
    expect(
      rechargePreview(10.01, { ...checkout, recharge_fee_rate: 1.6 }).fee,
    ).toBe(0.17);
    expect(
      rechargePreview(100, { ...checkout, balance_recharge_multiplier: 0.5 })
        .credited,
    ).toBe(50);
    expect(rechargePreview(NaN, checkout).total).toBe(0);
  });
  it("normalizes direct payment aliases with canonical method precedence", () => {
    const canonical = checkout.methods.alipay;
    const methods = visiblePaymentMethods({
      alipay_direct: { ...canonical, single_max: 20 },
      alipay: canonical,
    });
    expect(Object.keys(methods)).toEqual(["alipay"]);
    expect(methods.alipay.single_max).toBe(100);
    expect(
      validRecharge(15, "alipay", {
        ...checkout,
        methods: { alipay_direct: canonical },
      }),
    ).toBe(true);
  });
});
