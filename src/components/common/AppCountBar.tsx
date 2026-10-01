import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { AppId } from "@/lib/api/types";
import { APP_IDS, APP_ICON_MAP } from "@/config/appConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AgentCapabilityNote } from "./AgentCapabilityNote";
import { cn } from "@/lib/utils";

interface AppCountBarProps {
  totalLabel: string;
  counts: Partial<Record<AppId, number>>;
  appIds?: AppId[];
  showAllApps?: boolean;
  totalCount?: number;
  onToggleAll?: (app: AppId, enabled: boolean) => void | Promise<void>;
  pendingApp?: AppId | null;
  disabled?: boolean;
}

export const AppCountBar: React.FC<AppCountBarProps> = ({
  totalLabel,
  counts,
  appIds = APP_IDS,
  totalCount,
  showAllApps = false,
  onToggleAll,
  pendingApp,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const bulkToggleEnabled = totalCount !== undefined && !!onToggleAll;
  const bulkTotalCount = totalCount ?? 0;
  const hasPendingBulkToggle = pendingApp !== undefined && pendingApp !== null;

  return (
    <Card className="mb-4 shrink-0 rounded-xl shadow-none">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{totalLabel}</span>
          {showAllApps && APP_IDS.some((app) => !appIds.includes(app)) && (
            <span className="text-xs font-normal text-muted-foreground">
              {t("workspaceUi.capabilityHint")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 px-4 pb-4 pt-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {(showAllApps ? APP_IDS : appIds).map((app) => {
          const supported = appIds.includes(app);
          const count = counts[app] ?? 0;
          const allEnabled =
            bulkToggleEnabled && bulkTotalCount > 0 && count >= bulkTotalCount;
          const partiallyEnabled =
            bulkToggleEnabled && count > 0 && count < bulkTotalCount;
          const pending = pendingApp === app;
          const actionLabel = allEnabled
            ? t("common.disableAllForApp", { app: APP_ICON_MAP[app].label })
            : t("common.enableAllForApp", { app: APP_ICON_MAP[app].label });
          return (
            <label
              key={app}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-xs",
                supported
                  ? "bg-background"
                  : "bg-muted/30 text-muted-foreground",
              )}
            >
              {supported && bulkToggleEnabled && (
                <Checkbox
                  checked={partiallyEnabled ? "indeterminate" : allEnabled}
                  aria-busy={pending}
                  aria-label={actionLabel}
                  title={actionLabel}
                  data-selection-state={
                    pending
                      ? "pending"
                      : allEnabled
                        ? "all"
                        : partiallyEnabled
                          ? "partial"
                          : "none"
                  }
                  disabled={
                    disabled || bulkTotalCount === 0 || hasPendingBulkToggle
                  }
                  onCheckedChange={(checked) =>
                    void onToggleAll?.(app, checked === true)
                  }
                />
              )}
              <span className="shrink-0">{APP_ICON_MAP[app].icon}</span>
              <span
                className="min-w-0 flex-1 truncate"
                title={APP_ICON_MAP[app].label}
              >
                {APP_ICON_MAP[app].label}
              </span>
              {supported ? (
                <Badge
                  variant="secondary"
                  className="shrink-0 px-1.5 tabular-nums"
                >
                  {count}
                </Badge>
              ) : (
                <AgentCapabilityNote
                  label={
                    app === "claude-desktop"
                      ? t("skills.clientImport")
                      : undefined
                  }
                />
              )}
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
};
