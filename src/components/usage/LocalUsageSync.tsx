import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { usageApi } from "@/lib/api/usage";
import { Button } from "@/components/ui/button";

/** Incremental import only; never rebuild or delete original agent history. */
export function LocalUsageSync() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [manualRefresh, setManualRefresh] = useState(false);
  const sync = useQuery({
    queryKey: ["local-agent-usage-sync"],
    queryFn: usageApi.syncSessionUsage,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (sync.dataUpdatedAt)
      void client.invalidateQueries({ queryKey: ["usage"] });
  }, [client, sync.dataUpdatedAt]);
  return (
    <section
      className="mb-3 flex flex-wrap items-center justify-end gap-3"
      aria-label={t("localAnalytics.importTitle")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={sync.isFetching}
          onClick={() => {
            setManualRefresh(true);
            void sync.refetch();
          }}
        >
          <RefreshCw
            className={`h-4 w-4 ${sync.isFetching ? "animate-spin" : ""}`}
          />
          {t(
            sync.isFetching ? "localAnalytics.syncing" : "localAnalytics.sync",
          )}
        </Button>
      </div>
      {sync.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {t("localAnalytics.syncFailed")}
        </p>
      )}
      {sync.data?.errors.length ? (
        <ul
          role="alert"
          className="mt-3 max-h-36 overflow-y-auto text-xs text-destructive"
        >
          {sync.data.errors.slice(0, 20).map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      ) : null}
      {manualRefresh && sync.data && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {t("localAnalytics.syncResult", {
            imported: sync.data.imported,
            scanned: sync.data.filesScanned,
            errors: sync.data.errors.length,
            deferred: sync.data.deferredFiles,
          })}
        </p>
      )}
    </section>
  );
}
