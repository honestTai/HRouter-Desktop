import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Gift,
  Loader2,
  QrCode,
  ReceiptText,
  TicketCheck,
  Users,
  WalletCards,
} from "lucide-react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
import { HRouterPageShell } from "@/components/hrouter/HRouterPageShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { settingsApi } from "@/lib/api";
import {
  hrouterAccountApi,
  type HRouterCheckoutInfo,
  type HRouterModelPlazaEntry,
  type HRouterOrderResult,
} from "@/lib/api/hrouterPlatform";
import { extractErrorMessage } from "@/utils/errorUtils";

const methodNames: Record<string, string> = {
  alipay: "支付宝",
  alipay_direct: "支付宝",
  wxpay: "微信支付",
  wxpay_direct: "微信支付",
  stripe: "Stripe",
  easypay: "易支付",
  airwallex: "Airwallex",
};

const quickAmounts = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
const CACHE_SHARE = 0.96;

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    await invoke("copy_text_to_clipboard", { text: value });
  }
}

function finitePositive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function rebateRateForAmount(checkout: HRouterCheckoutInfo, amount: number) {
  if (!checkout.recharge_rebate_enabled) return 0;
  const tier = [...(checkout.recharge_rebate_tiers ?? [])]
    .sort((left, right) => right.min_amount - left.min_amount)
    .find(
      (item) =>
        amount >= item.min_amount &&
        (item.max_amount == null || amount <= item.max_amount),
    );
  const rate = tier?.rate ?? checkout.recharge_rebate_rate ?? 0;
  return Math.min(0.05, Math.max(0, Number(rate) || 0));
}

function creditedMultiplier(checkout: HRouterCheckoutInfo, amount: number) {
  return (
    Math.max(1, Number(checkout.balance_recharge_multiplier || 1)) +
    rebateRateForAmount(checkout, amount)
  );
}

function effectiveCachedCost(model: HRouterModelPlazaEntry, official = false) {
  const pricing = official ? model.official_pricing : model.pricing;
  if (!pricing || (pricing.billing_mode && pricing.billing_mode !== "token")) {
    return 0;
  }
  const input = finitePositive(pricing.input_price);
  const cache = finitePositive(pricing.cache_read_price) || input;
  if (!input && !cache) return 0;
  return input * (1 - CACHE_SHARE) + cache * CACHE_SHARE;
}

function estimateRecharge(
  amount: number,
  checkout: HRouterCheckoutInfo | undefined,
  model: HRouterModelPlazaEntry | undefined,
) {
  if (!checkout || !model || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const unitCost = effectiveCachedCost(model);
  const groupMultiplier =
    finitePositive(model.user_rate_multiplier) ||
    finitePositive(model.rate_multiplier) ||
    1;
  if (!unitCost) return null;
  const tokens =
    (amount * creditedMultiplier(checkout, amount)) /
    (unitCost * groupMultiplier);
  const officialCost = effectiveCachedCost(model, true);
  return {
    tokens,
    officialValue: officialCost ? tokens * officialCost : 0,
  };
}

function compactValue(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function HRouterBillingPage() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState("");
  const [showAllAmounts, setShowAllAmounts] = useState(false);
  const [referenceModel, setReferenceModel] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [payment, setPayment] = useState<HRouterOrderResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const profile = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "profile"],
    queryFn: hrouterAccountApi.profile,
    enabled: Boolean(session),
  });
  const checkout = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "checkout"],
    queryFn: hrouterAccountApi.checkoutInfo,
    enabled: Boolean(session),
  });
  const affiliate = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "affiliate"],
    queryFn: hrouterAccountApi.affiliate,
    enabled: Boolean(session),
  });
  const usageStats = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "usage-stats", "all"],
    queryFn: () => hrouterAccountApi.usageStats(),
    enabled: Boolean(session),
  });
  const modelStats = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "model-stats", "all"],
    queryFn: () => hrouterAccountApi.modelStats(),
    enabled: Boolean(session),
  });
  const modelPlaza = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "model-plaza"],
    queryFn: hrouterAccountApi.modelPlaza,
    enabled: Boolean(session),
  });

  const availableMethods = useMemo(
    () =>
      Object.entries(checkout.data?.methods ?? {}).filter(
        ([, value]) => value.available !== false && value.enabled !== false,
      ),
    [checkout.data],
  );
  const estimateModels = useMemo(
    () =>
      (modelPlaza.data ?? []).filter(
        (model) =>
          model.plaza_status !== "hidden" && effectiveCachedCost(model) > 0,
      ),
    [modelPlaza.data],
  );

  useEffect(() => {
    if (!method && availableMethods.length > 0) {
      setMethod(availableMethods[0][0]);
    }
  }, [availableMethods, method]);

  useEffect(() => {
    if (referenceModel || estimateModels.length === 0) return;
    const usageOrder = new Map(
      (modelStats.data?.models ?? []).map((model, index) => [
        model.model,
        index,
      ]),
    );
    const recommended = [...estimateModels].sort((left, right) => {
      const leftRank = usageOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = usageOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return effectiveCachedCost(left) - effectiveCachedCost(right);
    })[0];
    setReferenceModel(`${recommended.group_id}:${recommended.name}`);
  }, [estimateModels, modelStats.data, referenceModel]);

  useEffect(() => {
    if (!payment?.qr_code) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(payment.qr_code, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [payment]);

  const numericAmount = Number(amount);
  const selectedLimit = checkout.data?.methods?.[method];
  const amountValid =
    Number.isFinite(numericAmount) &&
    numericAmount >=
      (selectedLimit?.single_min || checkout.data?.global_min || 0) &&
    (!selectedLimit?.single_max || numericAmount <= selectedLimit.single_max);
  const selectedModel = estimateModels.find(
    (model) => `${model.group_id}:${model.name}` === referenceModel,
  );
  const inviteLink = affiliate.data?.aff_code
    ? `https://hrouter.net/register?aff=${affiliate.data.aff_code}`
    : "";

  const createOrder = useMutation({
    mutationFn: () => hrouterAccountApi.createOrder(numericAmount, method),
    onSuccess: async (result) => {
      setPayment(result);
      void queryClient.invalidateQueries({
        queryKey: ["hrouter-account", session?.user.id, "orders"],
      });
      if (result.pay_url) await settingsApi.openExternal(result.pay_url);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const redeem = useMutation({
    mutationFn: () => hrouterAccountApi.redeemCode(redeemCode.trim()),
    onSuccess: () => {
      setRedeemCode("");
      void queryClient.invalidateQueries({
        queryKey: ["hrouter-account", session?.user.id, "profile"],
      });
      toast.success(
        t("hrouterPlatform.redeemSuccess", { defaultValue: "兑换成功" }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const transferAffiliate = useMutation({
    mutationFn: hrouterAccountApi.transferAffiliate,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["hrouter-account", session?.user.id],
      });
      toast.success(
        t("hrouterPlatform.rebateTransferred", {
          defaultValue: "返利已转入余额",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const refresh = () =>
    void Promise.all([
      profile.refetch(),
      checkout.refetch(),
      affiliate.refetch(),
      usageStats.refetch(),
      modelStats.refetch(),
      modelPlaza.refetch(),
    ]);

  const handleCopy = async () => {
    if (!inviteLink) return;
    await copyText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={refresh}
        refreshing={
          profile.isFetching ||
          checkout.isFetching ||
          affiliate.isFetching ||
          usageStats.isFetching ||
          modelPlaza.isFetching
        }
      >
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)]">
          <section className="min-w-0 rounded-md border border-border-default bg-background p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <WalletCards className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">
                  {t("hrouterPlatform.accountRecharge", {
                    defaultValue: "账户充值",
                  })}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("hrouterPlatform.accountRechargeHint", {
                    defaultValue: "多种充值方式，安全便捷",
                  })}
                </p>
              </div>
            </div>

            <div className="grid gap-4 rounded-md bg-orange-500 px-5 py-4 text-white sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-white/75">
                  {t("hrouterPlatform.currentBalance")}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  ¥{Number(profile.data?.balance || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-white/75">
                  {t("hrouterPlatform.totalSpend", {
                    defaultValue: "总消费",
                  })}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  ¥{Number(usageStats.data?.total_actual_cost || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-white/75">
                  {t("hrouterPlatform.totalRequests", {
                    defaultValue: "总请求数",
                  })}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {Number(
                    usageStats.data?.total_requests || 0,
                  ).toLocaleString()}
                </p>
              </div>
            </div>

            {checkout.isLoading ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("hrouterPlatform.loadingPayments")}
              </div>
            ) : checkout.error ? (
              <p className="py-5 text-sm text-red-500">
                {extractErrorMessage(checkout.error)}
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="recharge-amount">
                      {t("hrouterPlatform.customAmount", {
                        defaultValue: "自定义金额",
                      })}
                    </Label>
                    <div className="relative mt-2">
                      <span className="absolute left-3 top-2 text-sm text-muted-foreground">
                        ¥
                      </span>
                      <Input
                        id="recharge-amount"
                        type="number"
                        min={
                          selectedLimit?.single_min ||
                          checkout.data?.global_min ||
                          1
                        }
                        max={
                          selectedLimit?.single_max ||
                          checkout.data?.global_max ||
                          undefined
                        }
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{t("hrouterPlatform.paymentMethod")}</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {availableMethods.map(([key, value]) => (
                        <Button
                          key={key}
                          type="button"
                          variant={method === key ? "default" : "outline"}
                          className="h-9"
                          onClick={() => setMethod(key)}
                        >
                          {methodNames[key] || value.display_name || key}
                        </Button>
                      ))}
                    </div>
                    {availableMethods.length === 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("hrouterPlatform.noPaymentMethods")}
                      </p>
                    )}
                  </div>
                </div>

                {checkout.data?.recharge_rebate_enabled && (
                  <div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    {t("hrouterPlatform.rechargeRebateNotice", {
                      defaultValue:
                        "当前充值返利 {{rate}}%：充值 ¥{{amount}} 到账 ¥{{credited}}，返利余额仅用于平台消费。",
                      rate: (
                        rebateRateForAmount(
                          checkout.data,
                          numericAmount || 100,
                        ) * 100
                      ).toFixed(0),
                      amount: (numericAmount || 100).toFixed(0),
                      credited: (
                        (numericAmount || 100) *
                        creditedMultiplier(checkout.data, numericAmount || 100)
                      ).toFixed(2),
                    })}
                  </div>
                )}

                <div className="grid items-center gap-3 rounded-md border border-border-default bg-muted/25 p-3 md:grid-cols-[minmax(160px,0.55fr)_minmax(0,1fr)]">
                  <div>
                    <Label>
                      {t("hrouterPlatform.referenceModel", {
                        defaultValue: "参考模型",
                      })}
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t("hrouterPlatform.referenceModelHint", {
                        defaultValue: "查看每档充值金额预计可用的 Token",
                      })}
                    </p>
                  </div>
                  <Select
                    value={referenceModel}
                    onValueChange={setReferenceModel}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("hrouterPlatform.selectReferenceModel", {
                          defaultValue: "选择参考模型",
                        })}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {estimateModels.map((model) => (
                        <SelectItem
                          key={`${model.group_id}:${model.name}`}
                          value={`${model.group_id}:${model.name}`}
                        >
                          {model.name} · {model.group_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>
                    {t("hrouterPlatform.selectRechargeAmount", {
                      defaultValue: "选择充值额度",
                    })}
                  </Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {quickAmounts
                      .slice(0, showAllAmounts ? quickAmounts.length : 8)
                      .map((value) => {
                        const estimate = estimateRecharge(
                          value,
                          checkout.data,
                          selectedModel,
                        );
                        const credited = checkout.data
                          ? value * creditedMultiplier(checkout.data, value)
                          : value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`min-h-[84px] rounded-md border px-2 py-2 text-center transition-colors ${
                              numericAmount === value
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border-default hover:border-primary/50 hover:bg-muted/30"
                            }`}
                            onClick={() => setAmount(String(value))}
                          >
                            <span className="block text-sm font-semibold">
                              ¥{value}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-emerald-600 dark:text-emerald-400">
                              {t("hrouterPlatform.creditedShort", {
                                defaultValue: "到账 ¥{{amount}}",
                                amount: credited.toFixed(2),
                              })}
                            </span>
                            <span className="mt-1 block text-xs font-semibold text-orange-600 dark:text-orange-400">
                              {estimate
                                ? t("hrouterPlatform.tokenEstimate", {
                                    defaultValue: "约 {{tokens}} Token",
                                    tokens: compactValue(estimate.tokens),
                                  })
                                : t("hrouterPlatform.estimateUnavailable", {
                                    defaultValue: "暂无估算",
                                  })}
                            </span>
                            {estimate && estimate.officialValue > 0 && (
                              <span className="block text-[10px] text-muted-foreground">
                                {t("hrouterPlatform.officialValueEstimate", {
                                  defaultValue: "约合官方 ${{value}}",
                                  value: compactValue(estimate.officialValue),
                                })}
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mx-auto mt-2 flex h-7 text-xs text-muted-foreground"
                    onClick={() => setShowAllAmounts((current) => !current)}
                  >
                    {showAllAmounts
                      ? t("hrouterPlatform.collapseAmounts", {
                          defaultValue: "收起更多额度",
                        })
                      : t("hrouterPlatform.expandAmounts", {
                          defaultValue: "展开更多额度（+1）",
                        })}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${showAllAmounts ? "rotate-180" : ""}`}
                    />
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    {t("hrouterPlatform.estimateDisclaimer", {
                      defaultValue:
                        "预估结果仅供参考，实际可用量会随请求内容和模型使用方式变化。",
                    })}
                  </p>
                </div>

                <Button
                  className="w-full"
                  disabled={!amountValid || !method || createOrder.isPending}
                  onClick={() => createOrder.mutate()}
                >
                  {createOrder.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {t("hrouterPlatform.confirmPayment", {
                    defaultValue: "确认支付 ¥{{amount}}",
                    amount: Number.isFinite(numericAmount)
                      ? numericAmount.toFixed(2)
                      : "0.00",
                  })}
                </Button>

                <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground before:h-px before:flex-1 before:bg-border-default after:h-px after:flex-1 after:bg-border-default">
                  {t("hrouterPlatform.redeemSection", {
                    defaultValue: "兑换码充值",
                  })}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={redeemCode}
                    onChange={(event) => setRedeemCode(event.target.value)}
                    placeholder={t("hrouterPlatform.redeemPlaceholder", {
                      defaultValue: "请输入兑换码",
                    })}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!redeemCode.trim() || redeem.isPending}
                    onClick={() => redeem.mutate()}
                  >
                    {redeem.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TicketCheck className="h-4 w-4" />
                    )}
                    {t("hrouterPlatform.redeemButton", {
                      defaultValue: "兑换额度",
                    })}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t("hrouterPlatform.redeemHint", {
                    defaultValue: "兑换码区分大小写",
                  })}
                </p>
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-md border border-border-default bg-background p-5">
            <div className="flex items-center gap-3 border-b border-border-default pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {t("hrouterPlatform.inviteRewardTitle", {
                    defaultValue: "邀请好友，享 {{rate}}% 返利",
                    rate: affiliate.data?.effective_rebate_rate_percent ?? 0,
                  })}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("hrouterPlatform.inviteRewardSubtitle", {
                    defaultValue: "邀请好友获得额外奖励",
                  })}
                </p>
              </div>
            </div>

            {affiliate.isLoading ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.loading", { defaultValue: "加载中..." })}
              </div>
            ) : affiliate.error ? (
              <p className="py-5 text-sm text-red-500">
                {extractErrorMessage(affiliate.error)}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-md bg-teal-600 p-4 text-white">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white/80">
                      {t("hrouterPlatform.revenueStats", {
                        defaultValue: "收益统计",
                      })}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 bg-white/15 px-2 text-[11px] text-white hover:bg-white/25"
                      disabled={
                        !affiliate.data?.aff_quota ||
                        transferAffiliate.isPending
                      }
                      onClick={() => transferAffiliate.mutate()}
                    >
                      {transferAffiliate.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      )}
                      {t("hrouterPlatform.transferToBalance", {
                        defaultValue: "转入余额",
                      })}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                    <div>
                      <p className="text-lg font-semibold tabular-nums">
                        ¥{Number(affiliate.data?.aff_quota || 0).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-white/70">
                        {t("hrouterPlatform.pendingRevenue", {
                          defaultValue: "待使用收益",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums">
                        ¥
                        {Number(affiliate.data?.aff_history_quota || 0).toFixed(
                          2,
                        )}
                      </p>
                      <p className="text-[10px] text-white/70">
                        {t("hrouterPlatform.totalRevenue", {
                          defaultValue: "总收益",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums">
                        {affiliate.data?.aff_count ?? 0}
                      </p>
                      <p className="text-[10px] text-white/70">
                        {t("hrouterPlatform.inviteCount")}
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums">
                        {affiliate.data?.effective_rebate_rate_percent ?? 0}%
                      </p>
                      <p className="text-[10px] text-white/70">
                        {t("hrouterPlatform.rebateRate")}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>
                    {t("hrouterPlatform.inviteLink", {
                      defaultValue: "邀请链接",
                    })}
                  </Label>
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-border-default bg-muted/30 p-1.5 pl-3">
                    <code className="min-w-0 flex-1 truncate text-[11px]">
                      {inviteLink || "-"}
                    </code>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      disabled={!inviteLink}
                      onClick={() => void handleCopy()}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {t("common.copy", { defaultValue: "复制" })}
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border border-teal-500/25 bg-teal-500/5 p-4 text-xs">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-teal-700 dark:text-teal-300">
                    <Users className="h-4 w-4" />
                    {t("hrouterPlatform.rewardDescription", {
                      defaultValue: "奖励说明",
                    })}
                  </div>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>
                      ·{" "}
                      {t("hrouterPlatform.rewardRuleShare", {
                        defaultValue: "将邀请码或邀请链接分享给新用户。",
                      })}
                    </li>
                    <li>
                      ·{" "}
                      {t("hrouterPlatform.rewardRuleRecharge", {
                        defaultValue:
                          "被邀请用户充值后，你可获得 {{rate}}% 的返利额度。",
                        rate:
                          affiliate.data?.effective_rebate_rate_percent ?? 0,
                      })}
                    </li>
                    <li>
                      ·{" "}
                      {t("hrouterPlatform.rewardRuleTransfer", {
                        defaultValue: "返利额度可随时转入账户余额。",
                      })}
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>

        <Dialog
          open={Boolean(payment)}
          onOpenChange={(open) => !open && setPayment(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("hrouterPlatform.completePayment")}</DialogTitle>
              <DialogDescription>
                {t("hrouterPlatform.paymentCreated")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center px-6 py-5">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={t("hrouterPlatform.paymentQr")}
                  className="h-56 w-56 rounded-md border border-border-default bg-white p-2"
                />
              ) : (
                <QrCode className="h-16 w-16 text-muted-foreground" />
              )}
              <p className="mt-4 text-lg font-semibold">
                ¥
                {Number(payment?.pay_amount || payment?.amount || 0).toFixed(2)}
              </p>
              <p className="mt-1 max-w-full truncate font-mono text-xs text-muted-foreground">
                {payment?.out_trade_no}
              </p>
            </div>
            <DialogFooter>
              {payment?.pay_url && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void settingsApi.openExternal(payment.pay_url || "")
                  }
                >
                  <CircleDollarSign className="h-4 w-4" />
                  {t("hrouterPlatform.openPayment")}
                </Button>
              )}
              <Button onClick={() => setPayment(null)}>
                <ReceiptText className="h-4 w-4" />
                {t("hrouterPlatform.paymentDone")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
