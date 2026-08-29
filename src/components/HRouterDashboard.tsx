import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CircleDollarSign,
  Clock3,
  KeyRound,
  Loader2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
import { HRouterPageShell } from "@/components/hrouter/HRouterPageShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { hrouterAccountApi } from "@/lib/api/hrouterPlatform";
import { extractErrorMessage } from "@/utils/errorUtils";

const MODEL_COLORS = [
  "#2563eb",
  "#10b981",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#eab308",
];

type RangeDays = 1 | 7 | 30;

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value || 0,
  );
}

function compactNumber(value: number | undefined) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatMoney(value: number | undefined, digits = 2) {
  return `¥${Number(value || 0).toFixed(digits)}`;
}

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeDates(days: RangeDays) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { startDate: localDate(start), endDate: localDate(end) };
}

function buildDateBuckets(days: RangeDays) {
  const { startDate, endDate } = rangeDates(days);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const bucketSize = days === 30 ? 3 : 1;
  const buckets: Array<{ startDate: string; endDate: string; label: string }> =
    [];

  for (let cursor = new Date(start); cursor <= end; ) {
    const bucketEnd = new Date(cursor);
    bucketEnd.setDate(bucketEnd.getDate() + bucketSize - 1);
    if (bucketEnd > end) bucketEnd.setTime(end.getTime());
    const startLabel = `${cursor.getMonth() + 1}/${cursor.getDate()}`;
    const endLabel = `${bucketEnd.getMonth() + 1}/${bucketEnd.getDate()}`;
    buckets.push({
      startDate: localDate(cursor),
      endDate: localDate(bucketEnd),
      label: startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`,
    });
    cursor = new Date(bucketEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function GaugeCard({
  label,
  display,
  percent,
  color,
}: {
  label: string;
  display: string;
  percent: number;
  color: string;
}) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative h-[190px] rounded-md border border-border-default bg-background px-3 pt-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ResponsiveContainer width="100%" height={145}>
        <RadialBarChart
          data={[{ value, fill: color }]}
          cx="50%"
          cy="78%"
          innerRadius="72%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            dataKey="value"
            angleAxisId={0}
            background
            cornerRadius={8}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center">
        <p className="text-xl font-semibold tabular-nums">{display}</p>
      </div>
    </div>
  );
}

export function HRouterDashboard() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const [days, setDays] = useState<RangeDays>(7);
  const [modelFilter, setModelFilter] = useState("all");
  const dates = useMemo(() => rangeDates(days), [days]);
  const trendBuckets = useMemo(() => buildDateBuckets(days), [days]);
  const profile = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "profile"],
    queryFn: hrouterAccountApi.profile,
    enabled: Boolean(session),
  });
  const dashboard = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "dashboard-stats"],
    queryFn: hrouterAccountApi.dashboardStats,
    enabled: Boolean(session),
  });
  const rangeStats = useQuery({
    queryKey: [
      "hrouter-account",
      session?.user.id,
      "usage-stats",
      dates.startDate,
      dates.endDate,
    ],
    queryFn: () => hrouterAccountApi.usageStats(dates.startDate, dates.endDate),
    enabled: Boolean(session),
  });
  const models = useQuery({
    queryKey: [
      "hrouter-account",
      session?.user.id,
      "dashboard-models",
      dates.startDate,
      dates.endDate,
    ],
    queryFn: () => hrouterAccountApi.modelStats(dates.startDate, dates.endDate),
    enabled: Boolean(session),
  });
  const trend = useQuery({
    queryKey: [
      "hrouter-account",
      session?.user.id,
      "dashboard-trend",
      dates.startDate,
      dates.endDate,
      modelFilter,
    ],
    queryFn: async () =>
      Promise.all(
        trendBuckets.map(async (bucket) => {
          const result = await hrouterAccountApi.modelStats(
            bucket.startDate,
            bucket.endDate,
          );
          const selected = result.models.filter(
            (item) => modelFilter === "all" || item.model === modelFilter,
          );
          return {
            label: bucket.label,
            requests: selected.reduce(
              (total, item) => total + Number(item.requests || 0),
              0,
            ),
            cost: selected.reduce(
              (total, item) => total + Number(item.actual_cost || 0),
              0,
            ),
            tokens: selected.reduce(
              (total, item) => total + Number(item.total_tokens || 0),
              0,
            ),
          };
        }),
      ),
    enabled: Boolean(session),
  });

  const refresh = () => {
    void Promise.all([
      profile.refetch(),
      dashboard.refetch(),
      rangeStats.refetch(),
      models.refetch(),
      trend.refetch(),
    ]);
  };
  const queries = [profile, dashboard, rangeStats, models, trend];
  const loading = queries.some((query) => query.isLoading);
  const error = queries.map((query) => query.error).find(Boolean);
  const filteredModels = (models.data?.models ?? []).filter(
    (item) => modelFilter === "all" || item.model === modelFilter,
  );
  const modelData = filteredModels.slice(0, 7);
  const modelChartData = modelData.map((item) => ({
    model: item.model,
    actual_cost: Number(item.actual_cost || 0),
  }));
  const trendData = trend.data ?? [];
  const filteredCost = filteredModels.reduce(
    (total, item) => total + Number(item.actual_cost || 0),
    0,
  );
  const filteredRequests = filteredModels.reduce(
    (total, item) => total + Number(item.requests || 0),
    0,
  );
  const filteredTokens = filteredModels.reduce(
    (total, item) => total + Number(item.total_tokens || 0),
    0,
  );
  const cacheTokens = Number(rangeStats.data?.total_cache_tokens || 0);
  const totalTokens = Number(rangeStats.data?.total_tokens || 0);
  const cacheHitRate = totalTokens > 0 ? (cacheTokens / totalTokens) * 100 : 0;
  const latency = Number(rangeStats.data?.average_duration_ms || 0);
  const latencyScore = 100 - (latency / 60_000) * 100;

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={refresh}
        refreshing={queries.some((query) => query.isFetching)}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-md border border-border-default bg-background p-0.5">
            {([1, 7, 30] as RangeDays[]).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={days === value ? "secondary" : "ghost"}
                className="h-7 px-3 text-xs"
                onClick={() => setDays(value)}
              >
                {value === 1
                  ? t("hrouterPlatform.today", { defaultValue: "今日" })
                  : t("hrouterPlatform.lastDays", {
                      defaultValue: "近 {{days}} 天",
                      days: value,
                    })}
              </Button>
            ))}
          </div>
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("hrouterPlatform.allModels", { defaultValue: "全部模型" })}
              </SelectItem>
              {(models.data?.models ?? []).map((item) => (
                <SelectItem key={item.model} value={item.model}>
                  {item.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
          <div className="space-y-4">
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
                  label: t("hrouterPlatform.rangeCost", {
                    defaultValue: "区间消费",
                  }),
                  value: formatMoney(
                    modelFilter === "all"
                      ? rangeStats.data?.total_actual_cost
                      : filteredCost,
                  ),
                  icon: Clock3,
                  tone: "text-orange-600 dark:text-orange-400",
                },
                {
                  label: t("hrouterPlatform.rangeRequests", {
                    defaultValue: "区间请求",
                  }),
                  value: formatNumber(
                    modelFilter === "all"
                      ? rangeStats.data?.total_requests
                      : filteredRequests,
                  ),
                  icon: Activity,
                  tone: "text-blue-600 dark:text-blue-400",
                },
                {
                  label: t("hrouterPlatform.activeKeys", {
                    defaultValue: "可用密钥",
                  }),
                  value: `${formatNumber(dashboard.data?.active_api_keys)} / ${formatNumber(dashboard.data?.total_api_keys)}`,
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

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)]">
              <section className="rounded-md border border-border-default bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {t("hrouterPlatform.usageTrend", {
                      defaultValue: "消费与请求趋势",
                    })}
                  </h3>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {compactNumber(
                      modelFilter === "all"
                        ? rangeStats.data?.total_tokens
                        : filteredTokens,
                    )}{" "}
                    Token
                  </span>
                </div>
                <div className="h-[230px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis
                        yAxisId="cost"
                        tick={{ fontSize: 11 }}
                        width={42}
                      />
                      <YAxis
                        yAxisId="requests"
                        orientation="right"
                        tick={{ fontSize: 11 }}
                        width={32}
                      />
                      <ChartTooltip
                        formatter={(value, name) =>
                          name === "cost"
                            ? [formatMoney(Number(value), 4), "消费"]
                            : [formatNumber(Number(value)), "请求"]
                        }
                      />
                      <Bar
                        yAxisId="cost"
                        dataKey="cost"
                        fill="#2563eb"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={32}
                      />
                      <Bar
                        yAxisId="requests"
                        dataKey="requests"
                        fill="#f97316"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-md border border-border-default bg-background p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  {t("hrouterPlatform.modelCostShare", {
                    defaultValue: "模型消费占比",
                  })}
                </h3>
                <div className="grid min-h-[230px] grid-cols-[minmax(180px,0.9fr)_minmax(0,1.1fr)] items-center">
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={modelChartData}
                        dataKey="actual_cost"
                        nameKey="model"
                        innerRadius={54}
                        outerRadius={82}
                        paddingAngle={2}
                      >
                        {modelData.map((item, index) => (
                          <Cell
                            key={item.model}
                            fill={MODEL_COLORS[index % MODEL_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <ChartTooltip
                        formatter={(value) => formatMoney(Number(value), 4)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="min-w-0 space-y-2">
                    {modelData.map((item, index) => (
                      <div
                        key={item.model}
                        className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2 text-xs"
                      >
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{
                            background:
                              MODEL_COLORS[index % MODEL_COLORS.length],
                          }}
                        />
                        <span className="truncate">{item.model}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatMoney(item.actual_cost, 2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.6fr)]">
              <div className="grid grid-cols-2 gap-4">
                <GaugeCard
                  label={t("hrouterPlatform.averageLatency", {
                    defaultValue: "平均响应",
                  })}
                  display={`${(latency / 1000).toFixed(1)}s`}
                  percent={latencyScore}
                  color="#10b981"
                />
                <GaugeCard
                  label={t("hrouterPlatform.cacheHitRate", {
                    defaultValue: "缓存 Token 占比",
                  })}
                  display={`${cacheHitRate.toFixed(1)}%`}
                  percent={cacheHitRate}
                  color="#8b5cf6"
                />
              </div>
              <section className="rounded-md border border-border-default bg-background p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  {t("hrouterPlatform.modelRequestRanking", {
                    defaultValue: "模型请求排行",
                  })}
                </h3>
                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={modelData.slice(0, 6)}
                      layout="vertical"
                      margin={{ left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="model"
                        tick={{ fontSize: 11 }}
                        width={120}
                      />
                      <ChartTooltip
                        formatter={(value) => [
                          formatNumber(Number(value)),
                          t("hrouterPlatform.requests", {
                            defaultValue: "请求",
                          }),
                        ]}
                      />
                      <Bar dataKey="requests" radius={[0, 3, 3, 0]}>
                        {modelData.slice(0, 6).map((item, index) => (
                          <Cell
                            key={item.model}
                            fill={MODEL_COLORS[index % MODEL_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>
        )}
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
