import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { providersApi, type AppId } from "@/lib/api";
import { ProviderIcon } from "@/components/ProviderIcon";
import { configuredModels } from "@/utils/providerModels";
import { cn } from "@/lib/utils";

export function AgentAccessCard({
  app,
  name,
  icon,
  selected,
  onSelect,
}: {
  app: AppId;
  name: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const state = useQuery({
    queryKey: ["agent-access", app],
    retry: false,
    refetchInterval: 10000,
    queryFn: async () => ({
      providers: await providersApi.getAll(app),
      current: await providersApi.getCurrent(app),
    }),
  });
  const provider = state.data?.providers[state.data.current];
  const additive = ["opencode", "openclaw", "hermes"].includes(app);
  const subtitle = state.isPending
    ? t("accessPlans.loading")
    : state.isError
      ? t("agentAccess.unavailable")
      : additive
        ? t("agentAccess.configCount", {
            count: Object.keys(state.data?.providers ?? {}).length,
          })
        : provider?.name || t("workspace.noSelection");
  const models = configuredModels(provider?.settingsConfig);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "min-w-0 rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <span className="flex items-center gap-2">
        <ProviderIcon icon={icon} name={name} size={22} />
        <span className="truncate text-sm font-medium">{name}</span>
      </span>
      <span
        className="mt-3 block truncate text-xs text-muted-foreground"
        title={subtitle}
      >
        {subtitle}
      </span>
      {models.length > 0 && (
        <span
          className="mt-1 block truncate text-xs text-muted-foreground"
          title={models.join(", ")}
        >
          {models.join(" · ")}
        </span>
      )}
    </button>
  );
}
