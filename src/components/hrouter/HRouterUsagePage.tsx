import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
import { HRouterPageShell } from "@/components/hrouter/HRouterPageShell";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { hrouterAccountApi } from "@/lib/api/hrouterPlatform";
import { extractErrorMessage } from "@/utils/errorUtils";

type RangeDays = 1 | 7 | 30;

function compactNumber(value: number | undefined) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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

function perMillion(cost: number | undefined, tokens: number | undefined) {
  if (!cost || !tokens) return "-";
  return `¥${((cost / tokens) * 1_000_000).toFixed(2)}/M`;
}

export function HRouterUsagePage() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const [page, setPage] = useState(1);
  const [days, setDays] = useState<RangeDays>(1);
  const [apiKeyId, setApiKeyId] = useState("all");
  const [groupId, setGroupId] = useState("all");
  const [requestType, setRequestType] = useState("all");
  const [modelDraft, setModelDraft] = useState("");
  const [model, setModel] = useState("");
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const dates = useMemo(() => rangeDates(days), [days]);
  const filters = {
    startDate: dates.startDate,
    endDate: dates.endDate,
    apiKeyId: apiKeyId === "all" ? undefined : Number(apiKeyId),
    groupId: groupId === "all" ? undefined : Number(groupId),
    requestType: requestType === "all" ? undefined : requestType,
    model: model || undefined,
  };
  const stats = useQuery({
    queryKey: [
      "hrouter-account",
      session?.user.id,
      "usage-stats",
      dates.startDate,
      dates.endDate,
      filters,
    ],
    queryFn: () =>
      hrouterAccountApi.usageStats(dates.startDate, dates.endDate, filters),
    enabled: Boolean(session),
  });
  const keys = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "keys"],
    queryFn: () => hrouterAccountApi.keys(1, 100),
    enabled: Boolean(session),
  });
  const groups = useQuery({
    queryKey: ["hrouter-account", "groups"],
    queryFn: hrouterAccountApi.groups,
    enabled: Boolean(session),
  });
  const logs = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "usage", page, filters],
    queryFn: () => hrouterAccountApi.usage(page, 20, filters),
    enabled: Boolean(session),
  });
  const refresh = () =>
    void Promise.all([
      stats.refetch(),
      keys.refetch(),
      groups.refetch(),
      logs.refetch(),
    ]);
  const changeFilter = (callback: () => void) => {
    callback();
    setPage(1);
  };
  const applyModel = () => changeFilter(() => setModel(modelDraft.trim()));
  const usageItems = logs.data?.items ?? [];
  const allRowsExpanded =
    usageItems.length > 0 &&
    usageItems.every((item) => expandedRows.has(item.id));
  const toggleRow = (id: number) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllRows = () => {
    setExpandedRows(
      allRowsExpanded ? new Set() : new Set(usageItems.map((item) => item.id)),
    );
  };

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={refresh}
        fitViewport
        refreshing={
          stats.isFetching ||
          keys.isFetching ||
          groups.isFetching ||
          logs.isFetching
        }
      >
        <Collapsible
          open={overviewOpen}
          onOpenChange={setOverviewOpen}
          className="mb-4 shrink-0 rounded-md border border-border-default bg-background"
          data-tour="usage-filters"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="flex h-10 w-full justify-between rounded-none px-3 text-xs"
            >
              <span className="flex items-center gap-2 font-medium">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t("hrouterPlatform.usageOverviewFilters", {
                  defaultValue: "统计与筛选",
                })}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${overviewOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border-default">
            {stats.data && (
              <div className="grid grid-cols-2 overflow-hidden border-b border-border-default xl:grid-cols-4">
                {[
                  [
                    t("hrouterPlatform.totalRequests"),
                    compactNumber(stats.data.total_requests),
                  ],
                  [
                    t("hrouterPlatform.totalTokens"),
                    compactNumber(stats.data.total_tokens),
                  ],
                  [
                    t("hrouterPlatform.totalCost"),
                    `¥${Number(stats.data.total_actual_cost || 0).toFixed(4)}`,
                  ],
                  [
                    t("hrouterPlatform.averageLatency", {
                      defaultValue: "平均响应",
                    }),
                    `${(Number(stats.data.average_duration_ms || 0) / 1000).toFixed(1)}s`,
                  ],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`px-4 py-3 ${index > 0 ? "border-l border-border-default" : ""}`}
                  >
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 p-2">
              <div className="flex rounded-md bg-muted/60 p-0.5">
                {([1, 7, 30] as RangeDays[]).map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={days === value ? "secondary" : "ghost"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => changeFilter(() => setDays(value))}
                  >
                    {value === 1
                      ? t("hrouterPlatform.last24Hours", {
                          defaultValue: "近 24 小时",
                        })
                      : t("hrouterPlatform.lastDays", {
                          defaultValue: "近 {{days}} 天",
                          days: value,
                        })}
                  </Button>
                ))}
              </div>
              <Select
                value={apiKeyId}
                onValueChange={(value) =>
                  changeFilter(() => setApiKeyId(value))
                }
              >
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("hrouterPlatform.allKeys", { defaultValue: "全部密钥" })}
                  </SelectItem>
                  {(keys.data?.items ?? []).map((key) => (
                    <SelectItem key={key.id} value={String(key.id)}>
                      {key.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={groupId}
                onValueChange={(value) => changeFilter(() => setGroupId(value))}
              >
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("hrouterPlatform.allGroups", {
                      defaultValue: "全部分组",
                    })}
                  </SelectItem>
                  {(groups.data ?? []).map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={requestType}
                onValueChange={(value) =>
                  changeFilter(() => setRequestType(value))
                }
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("hrouterPlatform.allTypes", {
                      defaultValue: "全部类型",
                    })}
                  </SelectItem>
                  <SelectItem value="stream">
                    {t("hrouterPlatform.stream", { defaultValue: "流式" })}
                  </SelectItem>
                  <SelectItem value="non_stream">
                    {t("hrouterPlatform.nonStream", { defaultValue: "非流式" })}
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="flex min-w-48 flex-1 items-center gap-1">
                <Input
                  value={modelDraft}
                  onChange={(event) => setModelDraft(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && applyModel()}
                  placeholder={t("hrouterPlatform.model", {
                    defaultValue: "模型",
                  })}
                  className="h-8 text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={applyModel}
                  title={t("hrouterPlatform.search", { defaultValue: "查询" })}
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {logs.isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("hrouterPlatform.loadingUsage")}
          </div>
        ) : logs.error ? (
          <div className="min-h-0 flex-1 border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            {extractErrorMessage(logs.error)}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border-default bg-background">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-default px-3">
              <p className="text-xs font-medium">
                {t("hrouterPlatform.usageDetails", {
                  defaultValue: "使用明细",
                })}
              </p>
              {usageItems.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={toggleAllRows}
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${allRowsExpanded ? "rotate-180" : ""}`}
                  />
                  {allRowsExpanded
                    ? t("hrouterPlatform.collapseAll", {
                        defaultValue: "全部收起",
                      })
                    : t("hrouterPlatform.expandAll", {
                        defaultValue: "全部展开",
                      })}
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]">
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_hsl(var(--border))]">
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-10 w-9 px-1" />
                    <TableHead className="h-10 w-[13%] px-2">
                      {t("hrouterPlatform.time")}
                    </TableHead>
                    <TableHead className="h-10 w-[18%] px-2">
                      {t("hrouterPlatform.keyGroup", {
                        defaultValue: "密钥 / 分组",
                      })}
                    </TableHead>
                    <TableHead className="h-10 w-[21%] px-2">
                      {t("hrouterPlatform.typeModel", {
                        defaultValue: "类型 / 模型",
                      })}
                    </TableHead>
                    <TableHead className="h-10 w-[12%] px-2 text-right">
                      {t("hrouterPlatform.durationFirstToken", {
                        defaultValue: "用时 / 首字",
                      })}
                    </TableHead>
                    <TableHead className="h-10 w-[14%] px-2 text-right">
                      {t("hrouterPlatform.inputOutput", {
                        defaultValue: "输入 / 输出",
                      })}
                    </TableHead>
                    <TableHead className="h-10 w-[13%] px-2 text-right">
                      {t("hrouterPlatform.actualCost")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageItems.map((item) => {
                    const expanded = expandedRows.has(item.id);
                    return (
                      <Fragment key={item.id}>
                        <TableRow
                          className="cursor-pointer"
                          aria-expanded={expanded}
                          onClick={() => toggleRow(item.id)}
                        >
                          <TableCell className="px-1 py-3 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleRow(item.id);
                              }}
                              aria-label={
                                expanded
                                  ? t("hrouterPlatform.collapseDetails", {
                                      defaultValue: "收起详情",
                                    })
                                  : t("hrouterPlatform.expandDetails", {
                                      defaultValue: "展开详情",
                                    })
                              }
                            >
                              <ChevronRight
                                className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
                              />
                            </Button>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-3 text-xs text-muted-foreground">
                            <span className="block truncate">
                              {dateTime(item.created_at)}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-3 text-xs">
                            <span className="block truncate font-medium">
                              {item.api_key?.name ||
                                `#${item.api_key_id ?? "-"}`}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {item.group?.name || `#${item.group_id ?? "-"}`}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-3 text-xs">
                            <span className="inline-flex rounded-sm bg-blue-500/10 px-1.5 py-0.5 text-[11px] text-blue-600 dark:text-blue-400">
                              {item.request_type ||
                                (item.stream ? "stream" : "-")}
                            </span>
                            <span className="mt-1 block truncate font-medium">
                              {item.model}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-3 text-right text-xs tabular-nums">
                            <span>
                              {item.duration_ms == null
                                ? "-"
                                : `${(item.duration_ms / 1000).toFixed(1)}s`}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {item.first_token_ms == null
                                ? "-"
                                : `${(item.first_token_ms / 1000).toFixed(1)}s`}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-3 text-right text-xs tabular-nums">
                            <span className="block">
                              {compactNumber(item.input_tokens)}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {compactNumber(item.output_tokens)}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-3 text-right text-xs font-medium tabular-nums">
                            ¥{Number(item.actual_cost || 0).toFixed(6)}
                            {item.rate_multiplier != null && (
                              <span className="block text-[10px] font-normal text-muted-foreground">
                                × {item.rate_multiplier}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={7} className="px-10 py-3">
                              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs md:grid-cols-3 xl:grid-cols-6">
                                {[
                                  [
                                    t("hrouterPlatform.requestId", {
                                      defaultValue: "请求 ID",
                                    }),
                                    item.request_id || `#${item.id}`,
                                  ],
                                  [
                                    t("hrouterPlatform.inputTokens", {
                                      defaultValue: "输入 Token",
                                    }),
                                    new Intl.NumberFormat().format(
                                      item.input_tokens || 0,
                                    ),
                                  ],
                                  [
                                    t("hrouterPlatform.outputTokens", {
                                      defaultValue: "输出 Token",
                                    }),
                                    new Intl.NumberFormat().format(
                                      item.output_tokens || 0,
                                    ),
                                  ],
                                  [
                                    t("hrouterPlatform.cacheReadTokens", {
                                      defaultValue: "缓存读取",
                                    }),
                                    new Intl.NumberFormat().format(
                                      item.cache_read_tokens || 0,
                                    ),
                                  ],
                                  [
                                    t("hrouterPlatform.cacheCreationTokens", {
                                      defaultValue: "缓存写入",
                                    }),
                                    new Intl.NumberFormat().format(
                                      item.cache_creation_tokens || 0,
                                    ),
                                  ],
                                  [
                                    t("hrouterPlatform.unitPrice", {
                                      defaultValue: "输入 / 输出价格",
                                    }),
                                    `${perMillion(item.input_cost, item.input_tokens)} / ${perMillion(item.output_cost, item.output_tokens)}`,
                                  ],
                                ].map(([label, value]) => (
                                  <div key={label} className="min-w-0">
                                    <p className="text-[11px] text-muted-foreground">
                                      {label}
                                    </p>
                                    <p
                                      className="mt-1 truncate font-medium tabular-nums"
                                      title={value}
                                    >
                                      {value}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                  {usageItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-40 text-center text-muted-foreground"
                      >
                        {t("hrouterPlatform.noUsage")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex h-12 shrink-0 items-center justify-between border-t border-border-default px-3 text-xs text-muted-foreground">
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
                  aria-label={t("hrouterPlatform.previousPage")}
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
                  aria-label={t("hrouterPlatform.nextPage")}
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
