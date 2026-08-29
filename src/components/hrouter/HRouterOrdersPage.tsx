import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import {
  hrouterAccountApi,
  type HRouterPaymentOrder,
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

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED" || normalized === "PAID")
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (normalized === "PENDING")
    return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
  if (normalized.includes("REFUND"))
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  return "bg-muted text-muted-foreground";
}

function statusName(status: string) {
  const normalized = status.toUpperCase();
  const names: Record<string, string> = {
    COMPLETED: "已支付",
    PAID: "已支付",
    PENDING: "待支付",
    CANCELLED: "已取消",
    CANCELED: "已取消",
    REFUNDED: "已退款",
    PARTIALLY_REFUNDED: "部分退款",
    FAILED: "支付失败",
    EXPIRED: "已过期",
  };
  return names[normalized] || status;
}

export function HRouterOrdersPage() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<HRouterPaymentOrder | null>(
    null,
  );
  const orders = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "orders", page, status],
    queryFn: () =>
      hrouterAccountApi.orders(page, 20, status === "all" ? undefined : status),
    enabled: Boolean(session),
  });
  const cancelOrder = useMutation({
    mutationFn: (id: number) => hrouterAccountApi.cancelOrder(id),
    onSuccess: () => {
      setCancelTarget(null);
      void queryClient.invalidateQueries({
        queryKey: ["hrouter-account", session?.user.id, "orders"],
      });
      toast.success(
        t("hrouterPlatform.orderCancelled", { defaultValue: "订单已取消" }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={() => void orders.refetch()}
        refreshing={orders.isFetching}
      >
        <div className="mb-4 flex justify-end">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("hrouterPlatform.allOrders", { defaultValue: "全部订单" })}
              </SelectItem>
              <SelectItem value="PENDING">
                {t("hrouterPlatform.pending", { defaultValue: "待支付" })}
              </SelectItem>
              <SelectItem value="COMPLETED">
                {t("hrouterPlatform.paid", { defaultValue: "已支付" })}
              </SelectItem>
              <SelectItem value="CANCELLED">
                {t("hrouterPlatform.cancelled", { defaultValue: "已取消" })}
              </SelectItem>
              <SelectItem value="REFUNDED">
                {t("hrouterPlatform.refunded", { defaultValue: "已退款" })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {orders.isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("common.loading", { defaultValue: "加载中..." })}
          </div>
        ) : orders.error ? (
          <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            {extractErrorMessage(orders.error)}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border-default bg-background">
            <div className="max-h-[calc(100vh-260px)] min-h-[360px] overflow-auto overscroll-contain [scrollbar-gutter:stable]">
              <Table className="min-w-[980px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-10">ID</TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.orderNumber")}
                    </TableHead>
                    <TableHead className="h-10 text-right">
                      {t("hrouterPlatform.paidAmount", {
                        defaultValue: "实付",
                      })}
                    </TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.method")}
                    </TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.status")}
                    </TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.createdAt")}
                    </TableHead>
                    <TableHead className="h-10 text-right">
                      {t("hrouterPlatform.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orders.data?.items ?? []).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                        {order.id}
                      </TableCell>
                      <TableCell className="max-w-64 truncate py-3 font-mono text-xs">
                        {order.out_trade_no}
                      </TableCell>
                      <TableCell className="py-3 text-right font-medium tabular-nums">
                        ¥{Number(order.pay_amount || order.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="py-3">
                        {methodNames[order.payment_type] || order.payment_type}
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${statusClass(order.status)}`}
                        >
                          {statusName(order.status)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        {order.status.toUpperCase() === "PENDING" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:text-red-500"
                            onClick={() => setCancelTarget(order)}
                            title={t("hrouterPlatform.cancelOrder", {
                              defaultValue: "取消订单",
                            })}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(orders.data?.items ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-40 text-center text-muted-foreground"
                      >
                        {t("hrouterPlatform.noOrders")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex h-12 items-center justify-between border-t border-border-default px-3 text-xs text-muted-foreground">
              <span>
                {t("hrouterPlatform.totalItems", {
                  count: orders.data?.total ?? 0,
                })}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-14 text-center">
                  {page} / {Math.max(1, orders.data?.pages ?? 1)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= (orders.data?.pages ?? 1)}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <Dialog
          open={Boolean(cancelTarget)}
          onOpenChange={(open) => !open && setCancelTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("hrouterPlatform.cancelOrder", { defaultValue: "取消订单" })}
              </DialogTitle>
              <DialogDescription>
                {t("hrouterPlatform.cancelOrderConfirm", {
                  defaultValue: "确认取消订单 {{order}}？",
                  order: cancelTarget?.out_trade_no,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelTarget(null)}>
                {t("common.close")}
              </Button>
              <Button
                variant="destructive"
                disabled={cancelOrder.isPending}
                onClick={() =>
                  cancelTarget && cancelOrder.mutate(cancelTarget.id)
                }
              >
                {cancelOrder.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t("hrouterPlatform.confirmCancel", {
                  defaultValue: "确认取消",
                })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
