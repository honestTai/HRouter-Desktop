import { useState, useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelPricing } from "@/lib/query/usage";
import { isNonNegativeDecimalString } from "@/types/usage";
import { Database, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { proxyApi } from "@/lib/api/proxy";
import {
  HROUTER_MODEL_PLAZA_QUERY_KEY,
  syncHRouterModelPlazaPricing,
} from "@/lib/hrouterModelPlazaPricing";

const PRICING_APPS = ["claude", "codex", "gemini", "grokbuild"] as const;
type PricingApp = (typeof PRICING_APPS)[number];
type PricingModelSource = "request" | "response";

interface AppConfig {
  multiplier: string;
  source: PricingModelSource;
}

type AppConfigState = Record<PricingApp, AppConfig>;

export function PricingConfigPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const localPricingQuery = useModelPricing();
  const plazaPricingQuery = useQuery({
    queryKey: HROUTER_MODEL_PLAZA_QUERY_KEY,
    queryFn: syncHRouterModelPlazaPricing,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const pricing =
    plazaPricingQuery.data?.pricing ?? localPricingQuery.data ?? [];
  const isUsingLocalFallback =
    !plazaPricingQuery.data && (localPricingQuery.data?.length ?? 0) > 0;

  // 三个应用的配置状态
  const [appConfigs, setAppConfigs] = useState<AppConfigState>({
    claude: { multiplier: "1", source: "response" },
    codex: { multiplier: "1", source: "response" },
    gemini: { multiplier: "1", source: "response" },
    grokbuild: { multiplier: "1", source: "response" },
  });
  const [originalConfigs, setOriginalConfigs] = useState<AppConfigState | null>(
    null,
  );
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 检查是否有改动
  const isDirty =
    originalConfigs !== null &&
    PRICING_APPS.some(
      (app) =>
        appConfigs[app].multiplier !== originalConfigs[app].multiplier ||
        appConfigs[app].source !== originalConfigs[app].source,
    );

  // 加载所有应用的配置
  useEffect(() => {
    let isMounted = true;

    const loadAllConfigs = async () => {
      if (!isTauri()) {
        setOriginalConfigs(appConfigs);
        setIsConfigLoading(false);
        return;
      }

      setIsConfigLoading(true);
      try {
        const results = await Promise.all(
          PRICING_APPS.map(async (app) => {
            const [multiplier, source] = await Promise.all([
              proxyApi.getDefaultCostMultiplier(app),
              proxyApi.getPricingModelSource(app),
            ]);
            return {
              app,
              multiplier,
              source: (source === "request"
                ? "request"
                : "response") as PricingModelSource,
            };
          }),
        );

        if (!isMounted) return;

        const newState: AppConfigState = {
          claude: { multiplier: "1", source: "response" },
          codex: { multiplier: "1", source: "response" },
          gemini: { multiplier: "1", source: "response" },
          grokbuild: { multiplier: "1", source: "response" },
        };
        for (const result of results) {
          newState[result.app] = {
            multiplier: result.multiplier,
            source: result.source,
          };
        }
        setAppConfigs(newState);
        setOriginalConfigs(newState);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown error";
        toast.error(
          t("settings.globalProxy.pricingLoadFailed", { error: message }),
        );
      } finally {
        if (isMounted) setIsConfigLoading(false);
      }
    };

    loadAllConfigs();
    return () => {
      isMounted = false;
    };
  }, [t]);

  // 保存所有配置
  const handleSaveAll = async () => {
    // 验证所有倍率
    for (const app of PRICING_APPS) {
      const trimmed = appConfigs[app].multiplier.trim();
      if (!trimmed) {
        toast.error(
          `${t(`apps.${app}`)}: ${t("settings.globalProxy.defaultCostMultiplierRequired")}`,
        );
        return;
      }
      if (!isNonNegativeDecimalString(trimmed)) {
        toast.error(
          `${t(`apps.${app}`)}: ${t("settings.globalProxy.defaultCostMultiplierInvalid")}`,
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      await Promise.all(
        PRICING_APPS.flatMap((app) => [
          proxyApi.setDefaultCostMultiplier(
            app,
            appConfigs[app].multiplier.trim(),
          ),
          proxyApi.setPricingModelSource(app, appConfigs[app].source),
        ]),
      );
      toast.success(t("settings.globalProxy.pricingSaved"));
      setOriginalConfigs({ ...appConfigs });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error";
      toast.error(
        t("settings.globalProxy.pricingSaveFailed", { error: message }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshPlazaPricing = async () => {
    const result = await plazaPricingQuery.refetch();
    if (result.data) {
      await queryClient.invalidateQueries({ queryKey: ["usage"] });
      toast.success(
        t("usage.modelPlazaSyncSuccess", {
          count: result.data.pricing.length,
        }),
      );
      return;
    }
    toast.error(t("usage.modelPlazaSyncFailed"));
  };

  if (plazaPricingQuery.isLoading && localPricingQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pricing.length === 0 && plazaPricingQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t("usage.loadPricingError")}: {String(plazaPricingQuery.error)}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* 全局计费默认配置 - 紧凑表格布局 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">
              {t("settings.globalProxy.pricingDefaultsTitle")}
            </h4>
            <p className="text-xs text-muted-foreground">
              {t("settings.globalProxy.pricingDefaultsDescription")}
            </p>
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={isConfigLoading || isSaving || !isDirty}
            size="sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              t("common.save")
            )}
          </Button>
        </div>

        {isConfigLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-24">
                    {t("settings.globalProxy.pricingAppLabel")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {t("settings.globalProxy.defaultCostMultiplierLabel")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {t("settings.globalProxy.pricingModelSourceLabel")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {PRICING_APPS.map((app, idx) => (
                  <tr
                    key={app}
                    className={
                      idx < PRICING_APPS.length - 1
                        ? "border-b border-border/30"
                        : ""
                    }
                  >
                    <td className="px-3 py-1.5 font-medium">
                      {t(`apps.${app}`)}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={appConfigs[app].multiplier}
                        onChange={(e) =>
                          setAppConfigs((prev) => ({
                            ...prev,
                            [app]: { ...prev[app], multiplier: e.target.value },
                          }))
                        }
                        disabled={isSaving}
                        placeholder="1"
                        className="h-7 w-24"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Select
                        value={appConfigs[app].source}
                        onValueChange={(value) =>
                          setAppConfigs((prev) => ({
                            ...prev,
                            [app]: {
                              ...prev[app],
                              source: value as PricingModelSource,
                            },
                          }))
                        }
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-7 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="response">
                            {t(
                              "settings.globalProxy.pricingModelSourceResponse",
                            )}
                          </SelectItem>
                          <SelectItem value="request">
                            {t(
                              "settings.globalProxy.pricingModelSourceRequest",
                            )}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分隔线 */}
      <div className="border-t border-border/50" />

      {/* 模型定价配置 */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0">
              <h4 className="text-sm font-medium">
                {t("usage.modelPlazaPricingTitle")}
              </h4>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {isUsingLocalFallback
                  ? t("usage.modelPlazaPricingFallback")
                  : t("usage.modelPlazaPricingDescription")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            disabled={plazaPricingQuery.isFetching}
            onClick={() => void handleRefreshPlazaPricing()}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                plazaPricingQuery.isFetching ? "animate-spin" : ""
              }`}
            />
            {t("common.refresh")}
          </Button>
        </div>

        <h4 className="text-sm font-medium text-muted-foreground">
          {t("usage.modelPricingDesc")} {t("usage.perMillion")}
        </h4>

        <div className="space-y-4">
          {pricing.length === 0 ? (
            <Alert>
              <AlertDescription>{t("usage.noPricingData")}</AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-md bg-card/60 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("usage.model")}</TableHead>
                    <TableHead>{t("usage.displayName")}</TableHead>
                    <TableHead className="text-right">
                      {t("usage.inputCost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("usage.outputCost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("usage.cacheReadCost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("usage.cacheWriteCost")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.map((model) => (
                    <TableRow key={model.modelId}>
                      <TableCell className="font-mono text-sm">
                        {model.modelId}
                      </TableCell>
                      <TableCell>{model.displayName}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ¥{model.inputCostPerMillion}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ¥{model.outputCostPerMillion}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ¥{model.cacheReadCostPerMillion}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ¥{model.cacheCreationCostPerMillion}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
