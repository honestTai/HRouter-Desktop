import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CircleDollarSign,
  Clock3,
  KeyRound,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
import { HRouterPageShell } from "@/components/hrouter/HRouterPageShell";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { hrouterAccountApi } from "@/lib/api/hrouterPlatform";
import { extractErrorMessage } from "@/utils/errorUtils";

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value || 0,
  );
}

function formatMoney(value: number | undefined) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

export function HRouterDashboard() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const profile = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "profile"],
    queryFn: hrouterAccountApi.profile,
    enabled: Boolean(session),
  });
  const stats = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "dashboard-stats"],
    queryFn: hrouterAccountApi.dashboardStats,
    enabled: Boolean(session),
  });
  const models = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "dashboard-models"],
    queryFn: () => hrouterAccountApi.modelStats(),
    enabled: Boolean(session),
  });

  const refresh = () => {
    void Promise.all([profile.refetch(), stats.refetch(), models.refetch()]);
  };
  const loading = profile.isLoading || stats.isLoading || models.isLoading;
  const error = profile.error || stats.error || models.error;

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={refresh}
        refreshing={profile.isFetching || stats.isFetching || models.isFetching}
      >
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("common.loading", { defaultValue: "加载中..." })}
          </div>
        ) : error ? (
          <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {extractErrorMessage(error)}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: t("hrouterPlatform.balance", {
                    defaultValue: "可用余额",
                  }),
                  value: formatMoney(profile.data?.balance),
                  icon: CircleDollarSign,
                  tone: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label: t("hrouterPlatform.todayCost", {
                    defaultValue: "今日消费",
                  }),
                  value: formatMoney(stats.data?.today_actual_cost),
                  icon: Clock3,
                  tone: "text-orange-600 dark:text-orange-400",
                },
                {
                  label: t("hrouterPlatform.totalRequests", {
                    defaultValue: "累计请求",
                  }),
                  value: formatNumber(stats.data?.total_requests),
                  icon: Activity,
                  tone: "text-blue-600 dark:text-blue-400",
                },
                {
                  label: t("hrouterPlatform.activeKeys", {
                    defaultValue: "可用密钥",
                  }),
                  value: `${formatNumber(stats.data?.active_api_keys)} / ${formatNumber(stats.data?.total_api_keys)}`,
                  icon: KeyRound,
                  tone: "text-violet-600 dark:text-violet-400",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-md border border-border-default bg-background px-4 py-4"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.label}</span>
                    <item.icon className={`h-4 w-4 ${item.tone}`} />
                  </div>
                  <div className="mt-3 text-xl font-semibold tabular-nums">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <section className="border-t border-border-default pt-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">
                    {t("hrouterPlatform.modelUsage", {
                      defaultValue: "模型使用概况",
                    })}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("hrouterPlatform.modelUsageDescription", {
                      defaultValue: "按实际消费排序",
                    })}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t("hrouterPlatform.totalCost", { defaultValue: "累计消费" })}{" "}
                  <strong className="font-semibold text-foreground">
                    {formatMoney(stats.data?.total_actual_cost)}
                  </strong>
                </span>
              </div>
              <div className="overflow-hidden rounded-md border border-border-default bg-background">
                {(models.data?.models ?? []).length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {t("hrouterPlatform.noUsage", {
                      defaultValue: "暂无使用记录",
                    })}
                  </div>
                ) : (
                  <div className="divide-y divide-border-default">
                    {(models.data?.models ?? []).slice(0, 8).map((model) => (
                      <div
                        key={model.model}
                        className="grid grid-cols-[minmax(0,1fr)_110px_120px] items-center gap-4 px-4 py-3 text-sm"
                      >
                        <span className="truncate font-medium">
                          {model.model}
                        </span>
                        <span className="text-right tabular-nums text-muted-foreground">
                          {t("hrouterPlatform.requestCount", {
                            value: formatNumber(model.requests),
                          })}
                        </span>
                        <span className="text-right font-medium tabular-nums">
                          {formatMoney(model.actual_cost)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
