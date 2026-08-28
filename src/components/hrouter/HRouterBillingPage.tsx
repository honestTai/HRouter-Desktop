import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, ExternalLink, Loader2, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
import { HRouterPageShell } from "@/components/hrouter/HRouterPageShell";
import { useHRouterSession } from "@/hooks/useHRouterSession";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  hrouterAccountApi,
  type HRouterOrderResult,
} from "@/lib/api/hrouterPlatform";
import { settingsApi } from "@/lib/api";
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

export function HRouterBillingPage() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("50");
  const [method, setMethod] = useState("");
  const [payment, setPayment] = useState<HRouterOrderResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
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
  const orders = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "orders"],
    queryFn: () => hrouterAccountApi.orders(),
    enabled: Boolean(session),
    refetchInterval: payment ? 5000 : false,
  });
  const availableMethods = useMemo(
    () =>
      Object.entries(checkout.data?.methods ?? {}).filter(
        ([, value]) => value.available,
      ),
    [checkout.data],
  );

  useEffect(() => {
    if (!method && availableMethods.length > 0)
      setMethod(availableMethods[0][0]);
  }, [availableMethods, method]);
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

  const createOrder = useMutation({
    mutationFn: () => hrouterAccountApi.createOrder(Number(amount), method),
    onSuccess: async (result) => {
      setPayment(result);
      void queryClient.invalidateQueries({
        queryKey: ["hrouter-account", session?.user.id, "orders"],
      });
      if (result.pay_url) await settingsApi.openExternal(result.pay_url);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const refresh = () =>
    void Promise.all([profile.refetch(), checkout.refetch(), orders.refetch()]);
  const selectedLimit = checkout.data?.methods?.[method];
  const numericAmount = Number(amount);
  const amountValid =
    Number.isFinite(numericAmount) &&
    numericAmount >=
      (selectedLimit?.single_min || checkout.data?.global_min || 0) &&
    (!selectedLimit?.single_max || numericAmount <= selectedLimit.single_max);

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={refresh}
        refreshing={
          profile.isFetching || checkout.isFetching || orders.isFetching
        }
      >
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="self-start rounded-md border border-border-default bg-background p-5">
            <div className="flex items-end justify-between border-b border-border-default pb-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("hrouterPlatform.currentBalance")}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  ¥{Number(profile.data?.balance || 0).toFixed(2)}
                </p>
              </div>
              <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
            {checkout.isLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("hrouterPlatform.loadingPayments")}
              </div>
            ) : checkout.error ? (
              <p className="py-5 text-sm text-red-500">
                {extractErrorMessage(checkout.error)}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="recharge-amount">
                    {t("hrouterPlatform.rechargeAmount")}
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
                  {selectedLimit && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {t("hrouterPlatform.paymentLimit", {
                        min: selectedLimit.single_min,
                        max: selectedLimit.single_max,
                      })}
                      {selectedLimit.fee_rate > 0 &&
                        t("hrouterPlatform.paymentFee", {
                          fee: (selectedLimit.fee_rate * 100).toFixed(1),
                        })}
                    </p>
                  )}
                </div>
                <div>
                  <Label>{t("hrouterPlatform.paymentMethod")}</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {availableMethods.map(([key, value]) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={method === key ? "default" : "outline"}
                        onClick={() => setMethod(key)}
                      >
                        {value.display_name || methodNames[key] || key}
                      </Button>
                    ))}
                  </div>
                  {availableMethods.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("hrouterPlatform.noPaymentMethods")}
                    </p>
                  )}
                </div>
                <Button
                  className="w-full"
                  disabled={!amountValid || !method || createOrder.isPending}
                  onClick={() => createOrder.mutate()}
                >
                  {createOrder.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {t("hrouterPlatform.rechargeNow")}
                </Button>
              </div>
            )}
          </section>

          <section className="min-w-0">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">
                {t("hrouterPlatform.recentOrders")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("hrouterPlatform.autoRefreshOrders")}
              </p>
            </div>
            <div className="overflow-hidden rounded-md border border-border-default bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-10">
                      {t("hrouterPlatform.orderNumber")}
                    </TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.method")}
                    </TableHead>
                    <TableHead className="h-10 text-right">
                      {t("hrouterPlatform.amount")}
                    </TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.status")}
                    </TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.createdAt")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orders.data?.items ?? []).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="max-w-44 truncate py-3 font-mono text-xs">
                        {order.out_trade_no}
                      </TableCell>
                      <TableCell className="py-3">
                        {methodNames[order.payment_type] || order.payment_type}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums">
                        ¥{Number(order.pay_amount || order.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${order.status === "COMPLETED" || order.status === "PAID" ? "bg-emerald-500/10 text-emerald-600" : order.status === "PENDING" ? "bg-orange-500/10 text-orange-600" : "bg-muted text-muted-foreground"}`}
                        >
                          {order.status}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(orders.data?.items ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-40 text-center text-muted-foreground"
                      >
                        {t("hrouterPlatform.noOrders")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
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
              <Button variant="outline" onClick={() => setPayment(null)}>
                {t("hrouterPlatform.payLater")}
              </Button>
              {payment?.pay_url && (
                <Button
                  onClick={() =>
                    void settingsApi.openExternal(payment.pay_url!)
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("hrouterPlatform.openPayment")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
