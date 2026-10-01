import { useTranslation } from "react-i18next";
import type { AppId } from "@/lib/api/types";
import { APP_IDS, APP_ICON_MAP } from "@/config/appConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Shared inventory is not filtered implicitly; new writes have an explicit target. */
export function AgentResourceContext({
  app,
  supported,
  onAppChange,
  disabled = false,
}: {
  app: AppId;
  supported: readonly AppId[];
  onAppChange?: (app: AppId) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="mb-4 flex shrink-0 flex-wrap items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3"
      aria-label={t("agentContext.target")}
    >
      <span className="text-xs font-medium">{t("agentContext.target")}</span>
      {onAppChange ? (
        <Select
          value={app}
          onValueChange={(value) => onAppChange(value as AppId)}
          disabled={disabled}
        >
          <SelectTrigger
            className="w-[210px] border-primary/40 bg-card font-medium"
            aria-label={t("agentContext.target")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APP_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                <span className="inline-flex items-center gap-2">
                  {APP_ICON_MAP[id].icon}
                  {APP_ICON_MAP[id].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          {APP_ICON_MAP[app].icon}
          {APP_ICON_MAP[app].label}
        </span>
      )}
      <p className="min-w-0 flex-1 basis-64 text-xs leading-5 text-muted-foreground">
        {t(
          supported.includes(app)
            ? "agentContext.sharedHint"
            : app === "claude-desktop"
              ? "agentContext.desktopSkills"
              : "agentContext.unsupported",
        )}
      </p>
    </section>
  );
}
