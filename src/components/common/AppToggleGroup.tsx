import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AppId } from "@/lib/api/types";
import { APP_IDS, APP_ICON_MAP } from "@/config/appConfig";

interface AppToggleGroupProps {
  apps: Partial<Record<AppId, boolean>>;
  onToggle: (app: AppId, enabled: boolean) => void;
  appIds?: AppId[];
  disabled?: boolean;
  showAllApps?: boolean;
}

export const AppToggleGroup: React.FC<AppToggleGroupProps> = ({
  apps,
  onToggle,
  appIds = APP_IDS,
  disabled = false,
  showAllApps = false,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(showAllApps ? APP_IDS : appIds).map((app) => {
        const supported = appIds.includes(app);
        const { label, icon, activeClass } = APP_ICON_MAP[app];
        const enabled = apps[app];
        return (
          <Tooltip key={app}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => onToggle(app, !enabled)}
                disabled={disabled || !supported}
                aria-label={label}
                aria-pressed={Boolean(enabled)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  enabled ? activeClass : "opacity-35 hover:opacity-70"
                } disabled:cursor-not-allowed`}
              >
                {icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {label}
                {!supported
                  ? ` · ${t(app === "claude-desktop" ? "skills.clientImport" : "workspaceUi.notAdapted")}`
                  : enabled
                    ? " ✓"
                    : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};
