import type {
  HRouterCheckoutInfo,
  HRouterPaymentMethod,
} from "@/lib/api/hrouterPlatform";
/** Matches the user-order state machine; PAID/RECHARGING are not credited yet. */
export function isPaymentPending(status?: string) {
  return !status || ["PENDING", "PAID", "RECHARGING"].includes(status);
}
export function validRecharge(
  amount: number,
  method: string,
  checkout?: HRouterCheckoutInfo,
) {
  const limit = visiblePaymentMethods(checkout?.methods ?? {})[method];
  if (
    !checkout ||
    checkout.balance_disabled ||
    !limit ||
    limit.available === false ||
    limit.enabled === false ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return false;
  const minimum = Math.max(0, checkout.global_min ?? 0, limit.single_min ?? 0);
  const maxima = [checkout.global_max, limit.single_max].filter(
    (n) => Number.isFinite(n) && n > 0,
  );
  return amount >= minimum && (!maxima.length || amount <= Math.min(...maxima));
}
export function safePaymentUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Mirrors sub2api paymentFlow: canonical methods take precedence over aliases. */
export function visiblePaymentMethods(
  methods: Record<string, HRouterPaymentMethod>,
) {
  const result: Record<string, HRouterPaymentMethod> = {};
  for (const [name, value] of Object.entries(methods)) {
    const normalized =
      (
        { alipay_direct: "alipay", wxpay_direct: "wxpay" } as Record<
          string,
          string
        >
      )[name.trim()] ?? name.trim();
    if (normalized && (!result[normalized] || name === normalized))
      result[normalized] = value;
  }
  return result;
}

/** Rates from checkout-info are percentages (5 means 5%), with half-open tiers. */
export function rechargeRebateRate(
  checkout: HRouterCheckoutInfo,
  amount: number,
) {
  const tier = checkout.recharge_rebate_tiers?.find(
    (item) =>
      amount >= item.min_amount &&
      (item.max_amount == null || amount < item.max_amount),
  );
  const rate =
    tier?.rate ??
    (checkout.recharge_rebate_enabled
      ? (checkout.recharge_rebate_rate ?? 0)
      : 0);
  return Number.isFinite(rate) ? Math.min(10, Math.max(0, rate)) : 0;
}

export function rechargePreview(
  amount: number,
  checkout?: HRouterCheckoutInfo,
) {
  const value = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const base = checkout?.balance_recharge_multiplier;
  const multiplier =
    (base != null && Number.isFinite(base) && base > 0 ? base : 1) *
    (1 + (checkout ? rechargeRebateRate(checkout, value) : 0) / 100);
  const rawFee = checkout?.recharge_fee_rate ?? 0;
  const feeRate = Number.isFinite(rawFee) && rawFee > 0 ? rawFee : 0;
  // Same cent-ceiling contract as sub2api useRechargeCheckout.
  const fee = Math.ceil(value * feeRate) / 100;
  return {
    feeRate,
    fee,
    total: Math.round((value + fee) * 100) / 100,
    credited: Math.round(value * multiplier * 100) / 100,
    multiplier,
  };
}
