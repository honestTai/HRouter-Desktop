import {
  isPaymentPending,
  validRecharge,
  safePaymentUrl,
  rechargeRebateRate,
  rechargePreview,
  visiblePaymentMethods,
} from "@/lib/hrouterPayment";
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

import { useHRouterSession } from "@/hooks/useHRouterSession";
import { settingsApi } from "@/lib/api";
import {
  hrouterAccountApi,
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

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    await invoke("copy_text_to_clipboard", { text: value });
  }
}

export function HRouterBillingPage() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [showAllAmounts, setShowAllAmounts] = useState(false);
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
  const availableMethods = useMemo(
    () =>
      Object.entries(
        visiblePaymentMethods(checkout.data?.methods ?? {}),
      ).filter(
        ([, value]) => value.available !== false && value.enabled !== false,
      ),
    [checkout.data],
  );
  useEffect(() => {
    if (!availableMethods.some(([key]) => key === method)) {
      setMethod(availableMethods[0]?.[0] ?? "");
      return;
    }
    if (
      Number(amount) > 0 &&
      !validRecharge(Number(amount), method, checkout.data)
    ) {
      const next = availableMethods.find(([key]) =>
        validRecharge(Number(amount), key, checkout.data),
      );
      if (next) setMethod(next[0]);
    }
  }, [availableMethods, method, amount, checkout.data]);

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
  const selectedLimit = visiblePaymentMethods(checkout.data?.methods ?? {})[
    method
  ];
  const preview = rechargePreview(numericAmount, checkout.data);
  const paymentCurrency =
    selectedLimit?.currency?.trim().toUpperCase() || "CNY";
  const formatPayment = (value: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: paymentCurrency,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${paymentCurrency}`;
    }
  };
  const presetAmounts = quickAmounts.filter((value) =>
    availableMethods.some(([key]) => validRecharge(value, key, checkout.data)),
  );
  const amountValid = validRecharge(numericAmount, method, checkout.data);
  const inviteLink = affiliate.data?.aff_code
    ? `https://hrouter.net/register?aff=${affiliate.data.aff_code}`
    : "";

  const createOrder = useMutation({
    mutationFn: () => {
      if (!amountValid) throw new Error(t("hrouterWorkspace.invalidAmount"));
      return hrouterAccountApi.createOrder(numericAmount, method);
    },
    onSuccess: async (result) => {
      setPayment(result);
      void queryClient.invalidateQueries({
        queryKey: ["hrouter-account", session?.user.id, "orders"],
      });
      if (result.pay_url) {
        const url = safePaymentUrl(result.pay_url);
        if (url) {
          try {
            await settingsApi.openExternal(url);
          } catch {
            toast.error(t("hrouterWorkspace.openPaymentError"));
          }
        } else toast.error(t("hrouterWorkspace.unsafePayment"));
      }
      if (!result.pay_url && !result.qr_code)
        toast.error(t("hrouterWorkspace.paymentUnsupported"));
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const order = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "order", payment?.order_id],
    queryFn: () => hrouterAccountApi.order(payment!.order_id),
    enabled: !!session && !!payment?.order_id,
    refetchInterval: (query) =>
      isPaymentPending(query.state.data?.status) &&
      (!payment?.expires_at || Date.parse(payment.expires_at) > Date.now())
        ? 4000
        : false,
    retry: false,
  });
  useEffect(() => {
    if (order.data?.status === "COMPLETED") {
      void queryClient.invalidateQueries({
        queryKey: ["hrouter-account", session?.user.id, "profile"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["hrouter-account", session?.user.id, "orders"],
      });
    }
  }, [order.data?.status, queryClient, session?.user.id]);
  const verify = useMutation({
    mutationFn: () =>
      payment?.out_trade_no
        ? hrouterAccountApi.verifyOrder(payment.out_trade_no)
        : hrouterAccountApi.order(payment!.order_id),
    onSuccess: (result) => {
      queryClient.setQueryData(
        ["hrouter-account", session?.user.id, "order", payment?.order_id],
        result,
      );
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
          usageStats.isFetching
        }
      >
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)]">
          <section className="min-w-0 rounded-xl border border-border-default bg-card p-5 sm:p-6">
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
                  {profile.isError || profile.data?.balance == null
                    ? "—"
                    : `¥${Number(profile.data.balance).toFixed(2)}`}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-white/75">
                  {t("hrouterPlatform.totalSpend", {
                    defaultValue: "总消费",
                  })}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {usageStats.isError ||
                  usageStats.data?.total_actual_cost == null
                    ? "—"
                    : `¥${Number(usageStats.data.total_actual_cost).toFixed(2)}`}
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
                {checkout.data?.balance_disabled ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    {t("hrouterWallet.unavailable")}
                  </p>
                ) : (
                  <>
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
                            step="0.01"
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
                          rate: rechargeRebateRate(
                            checkout.data,
                            numericAmount || 100,
                          ).toFixed(0),
                          amount: (numericAmount || 100).toFixed(0),
                          credited: rechargePreview(
                            numericAmount || 100,
                            checkout.data,
                          ).credited.toFixed(2),
                        })}
                      </div>
                    )}

                    <div>
                      <Label>
                        {t("hrouterPlatform.selectRechargeAmount", {
                          defaultValue: "选择充值额度",
                        })}
                      </Label>
                      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
                        {presetAmounts
                          .slice(0, showAllAmounts ? presetAmounts.length : 8)
                          .map((value) => {
                            const option = rechargePreview(
                              value,
                              checkout.data,
                            );
                            return (
                              <Button
                                variant="ghost"
                                size="auto"
                                key={value}
                                type="button"
                                aria-pressed={numericAmount === value}
                                className={`min-h-[88px] min-w-0 flex-col gap-1 whitespace-normal rounded-xl border px-3 py-4 text-center transition-colors ${
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
                                    amount: option.credited.toFixed(2),
                                  })}
                                </span>
                                {option.feeRate > 0 && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {t("hrouterWallet.actualPay")}:{" "}
                                    {formatPayment(option.total)}
                                  </span>
                                )}
                              </Button>
                            );
                          })}
                      </div>
                      {presetAmounts.length > 8 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mx-auto mt-2 flex h-7 text-xs text-muted-foreground"
                          onClick={() =>
                            setShowAllAmounts((current) => !current)
                          }
                        >
                          {showAllAmounts
                            ? t("hrouterPlatform.collapseAmounts", {
                                defaultValue: "收起更多额度",
                              })
                            : t("hrouterWallet.moreAmounts", {
                                count: presetAmounts.length - 8,
                              })}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${showAllAmounts ? "rotate-180" : ""}`}
                          />
                        </Button>
                      )}
                    </div>

                    {numericAmount > 0 && Number.isFinite(numericAmount) && (
                      <section
                        className="space-y-3 rounded-xl border bg-muted/25 p-4 text-sm"
                        aria-label={t("hrouterWallet.summary")}
                      >
                        <div className="flex justify-between gap-3">
                          <span>{t("hrouterWallet.rechargeAmount")}</span>
                          <strong>{formatPayment(numericAmount)}</strong>
                        </div>
                        {preview.feeRate > 0 && (
                          <div className="flex justify-between gap-3">
                            <span>
                              {t("hrouterWallet.fee")} ({preview.feeRate}%)
                            </span>
                            <span>{formatPayment(preview.fee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-3 border-t pt-3">
                          <span>{t("hrouterWallet.actualPay")}</span>
                          <strong>{formatPayment(preview.total)}</strong>
                        </div>
                        <div className="flex justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                          <span>{t("hrouterWallet.credited")}</span>
                          <strong>¥{preview.credited.toFixed(2)}</strong>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {t("hrouterWallet.finalAmountHint")}
                        </p>
                      </section>
                    )}

                    <Button
                      className="w-full"
                      disabled={
                        !amountValid || !method || createOrder.isPending
                      }
                      onClick={() => createOrder.mutate()}
                    >
                      {createOrder.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {t("hrouterWallet.pay", {
                        amount: formatPayment(preview.total),
                      })}
                    </Button>
                  </>
                )}

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

          <section className="min-w-0 rounded-xl border border-border-default bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-border-default pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {affiliate.data
                    ? t("hrouterPlatform.inviteRewardTitle", {
                        defaultValue: "邀请好友，享 {{rate}}% 返利",
                        rate: affiliate.data.effective_rebate_rate_percent,
                      })
                    : t("hrouterPlatform.inviteRewards", {
                        defaultValue: "邀请返利",
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
                {payment?.currency ?? "CNY"}{" "}
                {Number(payment?.pay_amount ?? payment?.amount ?? 0).toFixed(2)}
              </p>
              <p className="mt-1 max-w-full truncate font-mono text-xs text-muted-foreground">
                {payment?.out_trade_no}
              </p>
            </div>
            <div className="px-6 pb-4 text-sm" role="status">
              {order.data
                ? t(`hrouterWorkspace.orderStatus.${order.data.status}`, {
                    defaultValue: order.data.status,
                  })
                : t("hrouterWorkspace.checkingPayment")}
              {order.isError && (
                <p className="text-destructive">
                  {t("hrouterWorkspace.paymentQueryError")}
                </p>
              )}
            </div>
            <DialogFooter>
              {payment?.pay_url && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void (async () => {
                      const url = safePaymentUrl(payment.pay_url || "");
                      if (!url) {
                        toast.error(t("hrouterWorkspace.unsafePayment"));
                        return;
                      }
                      try {
                        await settingsApi.openExternal(url);
                      } catch {
                        toast.error(t("hrouterWorkspace.openPaymentError"));
                      }
                    })()
                  }
                >
                  <CircleDollarSign className="h-4 w-4" />
                  {t("hrouterPlatform.openPayment")}
                </Button>
              )}
              <Button
                onClick={() => verify.mutate()}
                disabled={
                  verify.isPending || !isPaymentPending(order.data?.status)
                }
              >
                <ReceiptText className="h-4 w-4" />
                {t("hrouterWorkspace.verifyPayment")}
              </Button>
              <Button variant="outline" onClick={() => setPayment(null)}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
