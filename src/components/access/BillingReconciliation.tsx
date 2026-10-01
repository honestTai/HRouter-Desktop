import { DateTimeField } from "@/components/ui/date-time-field";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { SearchSelect } from "@/components/ui/search-select";
import i18n from "i18next";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { providersApi, type AppId } from "@/lib/api";
import { usageApi } from "@/lib/api/usage";
import {
  hrouterAccountApi,
  type HRouterUsageStats,
} from "@/lib/api/hrouterPlatform";
import type { ProviderStats } from "@/types/usage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractErrorMessage } from "@/utils/errorUtils";

export function reconciliationRange(start: string, end: string) {
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T23:59:59`).getTime();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs > endMs
  )
    throw new Error(
      i18n.t("accessWorkbench.selectValidStartAndEndDates", {
        defaultValue: "请选择有效的起止日期。",
      }),
    );
  if (endMs - startMs > 93 * 86400000)
    throw new Error(
      i18n.t("accessWorkbench.compareAtMost93DaysAtATime", {
        defaultValue: "单次核对范围最多 93 天。",
      }),
    );
  return {
    startDate: Math.floor(startMs / 1000),
    endDate: Math.floor(endMs / 1000),
  };
}
function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function BillingReconciliation({ userId }: { userId: number }) {
  const { t } = useTranslation();

  const [app, setApp] = useState<AppId>("claude");
  const providers = useQuery({
    queryKey: ["providers", app, "workbench"],
    queryFn: () => providersApi.getAll(app),
  });
  const keys = useQuery({
    queryKey: ["hrouter-account", userId, "reconciliation-keys"],
    queryFn: async () => {
      const items = [];
      for (let page = 1; page <= 20; page++) {
        const response = await hrouterAccountApi.keys(page, 100);
        items.push(...response.items);
        if (items.length >= response.total || response.items.length < 100)
          break;
      }
      return items;
    },
  });
  const [providerId, setProviderId] = useState("");
  const [keyId, setKeyId] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    local: ProviderStats | null;
    remote: HRouterUsageStats;
    scope: string;
    rate: number | null;
  } | null>(null);
  const compare = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const range = reconciliationRange(start, end);
      const conversion = rate.trim() ? Number(rate) : null;
      if (
        conversion !== null &&
        (!Number.isFinite(conversion) || conversion <= 0)
      )
        throw new Error(
          t("accessWorkbench.enterAPositiveExchangeRateOrLeaveItBlank", {
            defaultValue: "参考汇率必须为正数，或留空分别展示币种。",
          }),
        );
      const [local, remote] = await Promise.all([
        usageApi.getProviderStats(range.startDate, range.endDate, app),
        hrouterAccountApi.usageStats(start, end, { apiKeyId: Number(keyId) }),
      ]);
      setResult({
        local: local.find((row) => row.providerId === providerId) ?? null,
        remote,
        rate: conversion,
        scope: t("accessWorkbench.billingScope", {
          defaultValue:
            "{{value0}} 至 {{value1}} · {{value2}} · {{value3}} / {{value4}} ↔ {{value5}}",
          value0: start,
          value1: end,
          value2: Intl.DateTimeFormat().resolvedOptions().timeZone,
          value3: app,
          value4: providers.data?.[providerId]?.name,
          value5:
            keys.data?.find((key) => String(key.id) === keyId)?.name ?? keyId,
        }),
      });
    } catch (e) {
      setError(
        extractErrorMessage(e) ||
          t("accessWorkbench.comparisonFailedPleaseTryAgain", {
            defaultValue: "核对失败，请重试。",
          }),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold">
        {t("accessWorkbench.compareHrouterBillingByDate", {
          defaultValue: "按日期核对 HRouter 账单",
        })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("accessWorkbench.matchALocalProviderToAnHrouterKeyAnd", {
          defaultValue:
            "手动对应本机供应商与 HRouter Key，按相同日期、时区查询。服务端包含该 Key 在其他设备或应用的调用，差额仅供排查。",
        })}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <SearchSelect
          aria-label={t("accessWorkbench.comparisonApp", {
            defaultValue: "核对应用",
          })}
          value={app}
          disabled={busy}
          onValueChange={(value) => {
            setApp(value as AppId);
            setProviderId("");
            setResult(null);
          }}
          options={[
            { value: "claude", label: "Claude Code" },
            { value: "codex", label: "Codex" },
          ]}
        />
        <SearchSelect
          aria-label={t("accessWorkbench.localBillingProvider", {
            defaultValue: "本机账单供应商",
          })}
          disabled={busy}
          value={providerId}
          onValueChange={(value) => {
            setProviderId(value);
            setResult(null);
          }}
          options={[
            {
              value: "",
              label: t("accessWorkbench.selectLocalProvider", {
                defaultValue: "选择本机供应商",
              }),
            },
            ...(Object.values(providers.data ?? {}).map((p) => ({
              value: p.id,
              label: p.name,
            })) ?? []),
          ]}
        />
        <SearchSelect
          aria-label={t("accessWorkbench.serverBillingKey", {
            defaultValue: "服务端账单 Key",
          })}
          disabled={busy}
          value={keyId}
          onValueChange={(value) => {
            setKeyId(value);
            setResult(null);
          }}
          options={[
            {
              value: "",
              label: t("accessWorkbench.selectHrouterKey", {
                defaultValue: "选择 HRouter Key",
              }),
            },
            ...(keys.data?.map((k) => ({
              value: String(k.id),
              label: k.name + "· #" + k.id,
            })) ?? []),
          ]}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          {t("accessWorkbench.startDate", { defaultValue: "起始日期" })}
          <DateTimeField
            value={start}
            disabled={busy}
            onValueChange={(value) => {
              setStart(value);
              setResult(null);
            }}
          />
        </label>
        <label className="space-y-2 text-sm">
          {t("accessWorkbench.endDate", { defaultValue: "结束日期" })}
          <DateTimeField
            value={end}
            disabled={busy}
            onValueChange={(value) => {
              setEnd(value);
              setResult(null);
            }}
          />
        </label>
        <label className="space-y-2 text-sm">
          {t("accessWorkbench.referenceRateCnyPerUsdOptional", {
            defaultValue: "参考汇率（1 USD 对应 CNY，可留空）",
          })}
          <Input
            type="number"
            min="0"
            step="any"
            value={rate}
            disabled={busy}
            onChange={(e) => {
              setRate(e.target.value);
              setResult(null);
            }}
            placeholder={t("accessWorkbench.noAssumedExchangeRate", {
              defaultValue: "不自动假定汇率",
            })}
          />
        </label>
      </div>
      <Button
        variant="outline"
        disabled={busy || !providerId || !keyId}
        onClick={() => void compare()}
      >
        {busy
          ? t("accessWorkbench.querying", { defaultValue: "查询中…" })
          : t("accessWorkbench.queryAndCompare", {
              defaultValue: "查询并核对",
            })}
      </Button>
      {(error || keys.error || providers.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || extractErrorMessage(keys.error || providers.error)}
        </p>
      )}
      {result && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{result.scope}</p>
          <Table className="w-full text-left text-sm">
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="py-2">
                  {t("accessWorkbench.metric", { defaultValue: "统计项" })}
                </TableHead>
                <TableHead>
                  {t("accessWorkbench.localEstimate125", {
                    defaultValue: "本机估算",
                  })}
                </TableHead>
                <TableHead>
                  {t("accessWorkbench.serverRecords", {
                    defaultValue: "服务端记录",
                  })}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="py-2">
                  {t("accessWorkbench.requests", { defaultValue: "请求数" })}
                </TableCell>
                <TableCell>{result.local?.requestCount ?? 0}</TableCell>
                <TableCell>{result.remote.total_requests}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="py-2">
                  {t("accessWorkbench.cost", { defaultValue: "费用" })}
                </TableCell>
                <TableCell>
                  ${Number(result.local?.totalCost ?? 0).toFixed(4)} USD
                </TableCell>
                <TableCell>
                  ¥{Number(result.remote.total_actual_cost).toFixed(4)} CNY
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          {result.rate !== null && (
            <p className="text-sm">
              {t("accessWorkbench.convertedDifference", {
                defaultValue:
                  "按参考汇率 {{rate}} 换算，服务端实际扣费减去本机估算为 ¥{{difference}}。这不是多扣费判定。",
                rate: result.rate,
                difference: (
                  Number(result.remote.total_actual_cost) -
                  Number(result.local?.totalCost ?? 0) * result.rate
                ).toFixed(4),
              })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t(
              "accessWorkbench.sessionsNotAttributedToTheSelectedProviderAreExcluded",
              {
                defaultValue:
                  "本机未归属到所选供应商的会话不会计入。差异请结合其他设备调用、请求重试、缓存、套餐与价格倍率，以及两侧逐笔记录核查。",
              },
            )}
          </p>
        </div>
      )}
    </section>
  );
}
