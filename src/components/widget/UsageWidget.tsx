import { isMac } from "@/lib/platform";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Minus,
  Plus,
  Minimize2,
  Pin,
  X,
  RefreshCw,
  Maximize2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { APP_IDS, APP_ICON_MAP } from "@/config/appConfig";
import type { AppId } from "@/lib/api/types";
import { usageWidgetApi } from "@/lib/api/usageWidget";
import { usageApi } from "@/lib/api/usage";
import { UsageMeter } from "./UsageMeter";

export function initialWidgetAgent(): AppId {
  const app =
    new URLSearchParams(window.location.search).get("agent") ??
    localStorage.getItem("hrouter-last-app");
  return APP_IDS.includes(app as AppId) ? (app as AppId) : "claude";
}
export function UsageWidget() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [app, setApp] = useState(initialWidgetAgent);
  const [pinned, setPinned] = useState(false);
  const [scale, setScale] = useState(1);
  const [controlBusy, setControlBusy] = useState(false);
  const control = async (action: () => Promise<unknown>) => {
    if (controlBusy) return;
    setControlBusy(true);
    try {
      await action();
    } catch {
      toast.error(t("usageWidget.windowError"));
    } finally {
      setControlBusy(false);
    }
  };
  const sync = useQuery({
    queryKey: ["usage-widget-sync"],
    queryFn: usageApi.syncSessionUsage,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  useEffect(() => {
    if (sync.dataUpdatedAt)
      void client.invalidateQueries({ queryKey: ["usage-widget"] });
  }, [sync.dataUpdatedAt, client]);
  const snapshot = useQuery({
    queryKey: ["usage-widget", app],
    queryFn: () => usageWidgetApi.snapshot(app),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  const data = snapshot.isError ? undefined : snapshot.data;
  const finance = useQuery({
    queryKey: [
      "usage-widget-finance",
      app,
      data?.providerId,
      data?.providerRevision,
    ],
    queryFn: () =>
      usageWidgetApi.finance(app, data!.providerId!, data!.providerRevision!),
    enabled:
      !!data?.financeEnabled && !!data.providerId && !!data.providerRevision,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  useEffect(() => {
    let disposed = false;
    const subscriptions = [
      listen<string>("usage-widget-agent", (e) => {
        if (APP_IDS.includes(e.payload as AppId)) setApp(e.payload as AppId);
      }),
      listen("provider-switched", () => {
        client.removeQueries({ queryKey: ["usage-widget-finance"] });
        void client.invalidateQueries({ queryKey: ["usage-widget"] });
      }),
    ];
    const stops: (() => void)[] = [];
    subscriptions.forEach((p) =>
      p
        .then((stop) => {
          if (disposed) stop();
          else stops.push(stop);
        })
        .catch(() => undefined),
    );
    const storage = (event: StorageEvent) => {
      if (
        event.key === "language" &&
        ["zh", "zh-TW", "en", "ja"].includes(event.newValue ?? "")
      ) {
        void i18n.changeLanguage(event.newValue!);
      }

      if (
        event.key === "hrouter-last-app" &&
        APP_IDS.includes(event.newValue as AppId)
      )
        setApp(event.newValue as AppId);
    };
    window.addEventListener("storage", storage);
    return () => {
      disposed = true;
      stops.forEach((stop) => stop());
      window.removeEventListener("storage", storage);
    };
  }, [client, i18n]);
  useEffect(() => {
    document.documentElement.style.fontSize = `${scale * 16}px`;
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [scale]);
  const fmt = (n: number | undefined) =>
    n == null
      ? "—"
      : new Intl.NumberFormat(undefined, {
          maximumFractionDigits: 1,
          notation: n >= 10000 ? "compact" : "standard",
        }).format(n);
  const money = (n: number) =>
    new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 4,
      minimumFractionDigits: 2,
    }).format(n);
  const summary = data?.summary;
  const total = summary?.realTotalTokens ?? 0;
  const account =
    !finance.isError && data?.financeEnabled ? finance.data : undefined;
  const refresh = () => {
    void snapshot.refetch();
    void sync.refetch();
    if (data?.financeEnabled) void finance.refetch();
  };
  return (
    <div
      className="flex h-screen min-w-0 flex-col bg-background text-foreground"
      data-testid="usage-widget"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-1 border-b px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {APP_ICON_MAP[app].icon}
          {APP_ICON_MAP[app].label}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t("usageWidget.shrink")}
            disabled={scale <= 0.75}
            onClick={() => setScale((n) => Math.max(0.75, n - 0.125))}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t("usageWidget.enlarge")}
            disabled={scale >= 1.5}
            onClick={() => setScale((n) => Math.min(1.5, n + 0.125))}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t("usageWidget.pin")}
            aria-pressed={pinned}
            disabled={controlBusy}
            onClick={() =>
              void control(async () => {
                await getCurrentWindow().setAlwaysOnTop(!pinned);
                setPinned(!pinned);
              })
            }
          >
            <Pin className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t("usageWidget.minimize")}
            disabled={controlBusy}
            onClick={() => void control(() => getCurrentWindow().minimize())}
          >
            <Minimize2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t("usageWidget.maximize")}
            disabled={controlBusy}
            onClick={() =>
              void control(() => getCurrentWindow().toggleMaximize())
            }
          >
            <Maximize2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t("common.close")}
            disabled={controlBusy}
            onClick={() => void control(() => getCurrentWindow().close())}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </header>
      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("usageWidget.today")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t("common.refresh")}
            onClick={refresh}
            disabled={snapshot.isFetching}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
        {snapshot.isPending ? (
          <p role="status">{t("common.loading")}</p>
        ) : snapshot.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t("usageWidget.dataError")}
          </p>
        ) : (
          <>
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                {fmt(total)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  Tokens
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("usageWidget.requests", {
                  count: summary?.totalRequests ?? 0,
                })}
              </p>
            </div>
            {(
              [
                ["input", summary?.totalInputTokens],
                ["output", summary?.totalOutputTokens],
                ["cacheRead", summary?.totalCacheReadTokens],
                ["cacheWrite", summary?.totalCacheCreationTokens],
              ] as const
            ).map(([label, value]) => (
              <UsageMeter
                key={label}
                label={t(`usageWidget.${label}`)}
                value={value ?? 0}
                total={total}
                display={fmt(value)}
              />
            ))}
            <UsageMeter
              label={t("usageWidget.cacheRate")}
              value={(summary?.cacheHitRate ?? 0) * 100}
              total={100}
              display={`${((summary?.cacheHitRate ?? 0) * 100).toFixed(1)}%`}
            />
            <UsageMeter
              label={t("usageWidget.speed")}
              value={data?.tokensPerSecond ?? 0}
              total={data?.tokensPerSecond == null ? 0 : 100}
              display={
                data?.tokensPerSecond == null
                  ? "—"
                  : `${data.tokensPerSecond.toFixed(1)} tok/s`
              }
              hint={
                data?.tokensPerSecond == null
                  ? t("usageWidget.speedUnavailable")
                  : t("usageWidget.speedHint", {
                      count: data?.speedSamples ?? 0,
                    })
              }
            />
            <section
              className="space-y-3 border-t pt-3"
              aria-label={t("usageWidget.provider")}
            >
              <h2 className="break-words text-sm font-medium">
                {data?.providerName ?? t("usageWidget.noProvider")}
              </h2>
              {finance.isFetching && !account && (
                <p className="text-xs text-muted-foreground">
                  {t("common.loading")}
                </p>
              )}
              {finance.isError && data?.financeEnabled && (
                <p role="alert" className="text-xs text-destructive">
                  {t("usageWidget.financeError")}
                </p>
              )}
              {data?.tokensPerSecond == null &&
                account?.tokensPerMinute != null && (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between gap-3">
                      <span>{t("usageWidget.throughput")}</span>
                      <strong>{fmt(account.tokensPerMinute)} tok/min</strong>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {t("usageWidget.throughputHint")}
                    </p>
                  </div>
                )}
              {account?.totalSpent != null && (
                <div className="flex justify-between gap-3 text-sm">
                  <span>{t("usageWidget.totalSpent")}</span>
                  <strong>
                    {money(account.totalSpent)} {account.unit}
                  </strong>
                </div>
              )}
              {account?.todayCost != null && (
                <div className="flex justify-between text-sm">
                  <span>{t("usageWidget.todayCost")}</span>
                  <strong>
                    {money(account.todayCost)} {account.unit}
                  </strong>
                </div>
              )}
              {account?.plans?.map((plan, i) => (
                <div key={i} className="space-y-1 text-xs">
                  <span>{plan.planName}</span>
                  {plan.isValid === false ? (
                    <p>{plan.invalidMessage ?? t("usageWidget.invalidPlan")}</p>
                  ) : (
                    <>
                      {plan.used != null && (
                        <UsageMeter
                          label={t("usageWidget.used")}
                          value={plan.used ?? 0}
                          total={plan.total ?? 0}
                          display={
                            plan.used == null
                              ? "—"
                              : `${money(plan.used)} ${plan.unit ?? ""}`
                          }
                        />
                      )}
                      {plan.remaining != null && (
                        <p className="text-muted-foreground">
                          {t("usageWidget.remaining")}: {money(plan.remaining)}{" "}
                          {plan.unit}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </section>
          </>
        )}
        {isMac() && (
          <section className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <h2 className="text-xs font-medium">
              {t("usageWidget.nativeTitle")}
            </h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("usageWidget.nativeHelp")}
            </p>
          </section>
        )}
        {(sync.isError || !!sync.data?.errors.length) && (
          <p className="text-xs text-destructive" role="alert">
            {t("usageWidget.syncError")}
          </p>
        )}
      </main>
      <footer className="shrink-0 border-t px-4 py-2 text-[10px] text-muted-foreground">
        {data
          ? `${t("usageWidget.updated")} ${new Date(data.measuredAt * 1000).toLocaleTimeString()}`
          : t("usageWidget.follow")}
      </footer>
    </div>
  );
}
