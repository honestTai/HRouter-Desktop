import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
import { HRouterPageShell } from "@/components/hrouter/HRouterPageShell";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hrouterAccountApi } from "@/lib/api/hrouterPlatform";
import { extractErrorMessage } from "@/utils/errorUtils";

function compactNumber(value: number | undefined) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(
    value || 0,
  );
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function HRouterUsagePage() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const [page, setPage] = useState(1);
  const stats = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "dashboard-stats"],
    queryFn: hrouterAccountApi.dashboardStats,
    enabled: Boolean(session),
  });
  const logs = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "usage", page],
    queryFn: () => hrouterAccountApi.usage(page, 20),
    enabled: Boolean(session),
  });
  const refresh = () => void Promise.all([stats.refetch(), logs.refetch()]);

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={refresh}
        refreshing={stats.isFetching || logs.isFetching}
      >
        {stats.data && (
          <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-md border border-border-default bg-background">
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t("hrouterPlatform.totalRequests")}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {compactNumber(stats.data.total_requests)}
              </p>
            </div>
            <div className="border-x border-border-default px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t("hrouterPlatform.totalTokens")}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {compactNumber(stats.data.total_tokens)}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t("hrouterPlatform.totalCost")}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                ¥{Number(stats.data.total_actual_cost || 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {logs.isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("hrouterPlatform.loadingUsage")}
          </div>
        ) : logs.error ? (
          <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            {extractErrorMessage(logs.error)}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border-default bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-10">
                    {t("hrouterPlatform.time")}
                  </TableHead>
                  <TableHead className="h-10">
                    {t("hrouterPlatform.model")}
                  </TableHead>
                  <TableHead className="h-10 text-right">
                    {t("hrouterPlatform.input")}
                  </TableHead>
                  <TableHead className="h-10 text-right">
                    {t("hrouterPlatform.output")}
                  </TableHead>
                  <TableHead className="h-10 text-right">
                    {t("hrouterPlatform.duration")}
                  </TableHead>
                  <TableHead className="h-10 text-right">
                    {t("hrouterPlatform.actualCost")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-3 text-xs text-muted-foreground">
                      {dateTime(item.created_at)}
                    </TableCell>
                    <TableCell className="max-w-56 truncate py-3 font-medium">
                      {item.model}
                    </TableCell>
                    <TableCell className="py-3 text-right tabular-nums">
                      {compactNumber(item.input_tokens)}
                    </TableCell>
                    <TableCell className="py-3 text-right tabular-nums">
                      {compactNumber(item.output_tokens)}
                    </TableCell>
                    <TableCell className="py-3 text-right tabular-nums text-muted-foreground">
                      {item.duration_ms == null
                        ? "-"
                        : `${(item.duration_ms / 1000).toFixed(1)}s`}
                    </TableCell>
                    <TableCell className="py-3 text-right font-medium tabular-nums">
                      ¥{Number(item.actual_cost || 0).toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
                {(logs.data?.items ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-40 text-center text-muted-foreground"
                    >
                      {t("hrouterPlatform.noUsage")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex h-12 items-center justify-between border-t border-border-default px-3 text-xs text-muted-foreground">
              <span>
                {t("hrouterPlatform.totalItems", {
                  count: logs.data?.total ?? 0,
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
                  {page} / {Math.max(1, logs.data?.pages ?? 1)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= (logs.data?.pages ?? 1)}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
