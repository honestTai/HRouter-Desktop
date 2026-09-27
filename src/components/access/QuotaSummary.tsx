import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { accessApi } from "@/lib/api/access";
import { providersApi, type AppId } from "@/lib/api";
import { usageApi } from "@/lib/api/usage";
import type { UsageResult } from "@/types";
import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/utils/errorUtils";

export function sumIndependentQuotas(results: UsageResult[]) {
  const totals: Record<string, number> = {};
  let missing = 0;
  for (const result of results) {
    if (!result.success || !result.data?.length) {
      missing++;
      continue;
    }
    for (const plan of result.data) {
      const unit = plan.unit?.trim();
      if (
        plan.isValid === false ||
        !unit ||
        typeof plan.remaining !== "number" ||
        !Number.isFinite(plan.remaining) ||
        plan.remaining < 0
      ) {
        missing++;
        continue;
      }
      totals[unit] = (totals[unit] ?? 0) + plan.remaining;
    }
  }
  return { totals, missing };
}

export function QuotaSummary({ app }: { app: AppId }) {
  const { t } = useTranslation();

  const routes = useQuery({
    queryKey: ["model-routes", app],
    queryFn: () => accessApi.modelRoutes(app),
  });
  const providers = useQuery({
    queryKey: ["providers", app, "workbench"],
    queryFn: () => providersApi.getAll(app),
  });
  const [model, setModel] = useState("");
  const [independent, setIndependent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<
    { name: string; result: UsageResult }[] | null
  >(null);
  const [testedAt, setTestedAt] = useState("");
  const route = routes.data?.find((r) => r.model === model);
  const summary = report
    ? sumIndependentQuotas(report.map((r) => r.result))
    : null;
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <h3 className="font-semibold">
        {t("accessWorkbench.multiKeyRouteQuotas", {
          defaultValue: "多 Key 线路额度",
        })}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t("accessWorkbench.queryEachProviderSConfiguredUsageScriptForA", {
          defaultValue:
            "按已保存的模型主备组查询各供应商已有的用量接口。查询结果来自供应商配置的用量脚本，不发起模型推理；未配置或查询失败会单独显示。",
        })}
      </p>
      <select
        className="h-10 border rounded bg-background px-3"
        aria-label={t("accessWorkbench.quotaRouteGroup", {
          defaultValue: "额度线路组",
        })}
        value={model}
        disabled={busy}
        onChange={(e) => {
          setModel(e.target.value);
          setReport(null);
          setIndependent(false);
        }}
      >
        <option value="">
          {t("accessWorkbench.selectModelRouteGroup", {
            defaultValue: "选择模型主备组",
          })}
        </option>
        {routes.data?.map((r) => (
          <option key={r.model} value={r.model}>
            {r.model}
          </option>
        ))}
      </select>
      <Button
        disabled={busy || !route}
        onClick={() => {
          if (!route) return;
          const ids = [...new Set(route.providers)];
          setBusy(true);
          setReport(null);
          void (async () => {
            const results = await Promise.allSettled(
              ids.map((id) => usageApi.query(id, app)),
            );
            setReport(
              results.map((result, i) => ({
                name: providers.data?.[ids[i]]?.name ?? ids[i],
                result:
                  result.status === "fulfilled"
                    ? result.value
                    : {
                        success: false,
                        error: extractErrorMessage(result.reason),
                      },
              })),
            );
            setTestedAt(new Date().toLocaleString());
            setBusy(false);
          })();
        }}
      >
        {t("accessWorkbench.refreshGroupQuotas", {
          defaultValue: "刷新组内额度",
        })}
      </Button>
      {report && (
        <>
          <p className="text-xs text-muted-foreground">
            {t("accessWorkbench.queriedAt", { defaultValue: "查询时间：" })}
            {testedAt}
          </p>
          {report.map((row, i) => (
            <div key={i} className="text-sm">
              <strong>{row.name}</strong>：
              {row.result.success && row.result.data?.length
                ? row.result.data.map((plan, j) => (
                    <span key={j} className="mr-3">
                      {plan.planName ??
                        t("accessWorkbench.plan", {
                          defaultValue: "套餐",
                        })}{" "}
                      {plan.isValid === false
                        ? t("accessWorkbench.unavailable", {
                            defaultValue: "不可用",
                          })
                        : t("accessWorkbench.remainingQuota", {
                            defaultValue: "剩余 {{value0}} {{value1}}",
                            value0:
                              plan.remaining ??
                              t("accessWorkbench.unknown", {
                                defaultValue: "未知",
                              }),
                            value1:
                              plan.unit ??
                              t("accessWorkbench.unknownUnit", {
                                defaultValue: "单位未知",
                              }),
                          })}
                    </span>
                  ))
                : (row.result.error ??
                  t("accessWorkbench.quotaUnavailable", {
                    defaultValue: "无法取得额度",
                  }))}
            </div>
          ))}
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={independent}
              onChange={(e) => setIndependent(e.target.checked)}
            />
            {t(
              "accessWorkbench.iConfirmTheseKeysAndPlansHaveIndependentQuotas",
              {
                defaultValue:
                  "确认这些 Key 及套餐的额度相互独立，按相同单位汇总",
              },
            )}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("accessWorkbench.keysOnOneAccountMayShareABalanceKeep", {
              defaultValue:
                "同一账户下多个 Key 可能共享同一余额；这种情况下请保留逐项展示，避免重复相加。不同币种或单位不换算。",
            })}
          </p>
          {independent && summary && (
            <p role="status" className="text-sm">
              {summary.missing
                ? t("accessWorkbench.knownPartialTotal", {
                    defaultValue: "已知部分合计",
                  })
                : t("accessWorkbench.totalRemainingQuota", {
                    defaultValue: "剩余额度合计",
                  })}
              ：
              {Object.entries(summary.totals)
                .map(([unit, total]) => `${total.toLocaleString()} ${unit}`)
                .join("；") ||
                t("accessWorkbench.nothingToTotal", {
                  defaultValue: "无可汇总数据",
                })}
              。
              {summary.missing > 0 &&
                t("accessWorkbench.excludedQuotas", {
                  defaultValue: "{{value0}} 项缺失、不可用或单位不明，未计入。",
                  value0: summary.missing,
                })}
            </p>
          )}
        </>
      )}
      {(routes.error || providers.error) && (
        <p role="alert" className="text-sm text-destructive">
          {extractErrorMessage(routes.error || providers.error)}
        </p>
      )}
    </section>
  );
}
