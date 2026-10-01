import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <AgentCard
      name={name}
      icon={icon}
      selected={selected}
      onSelect={onSelect}
      subtitle={subtitle}
      models={models}
    />
  );
}

export function AgentCard({
  name,
  icon,
  mark,
  selected,
  onSelect,
  subtitle,
  models,
}: {
  name: string;
  icon?: string;
  mark?: string;
  selected: boolean;
  onSelect: () => void;
  subtitle: string;
  models: string[];
}) {
  return (
    <Button
      variant="ghost"
      size="auto"
      type="button"
      aria-label={name}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex-col items-stretch justify-start gap-0 whitespace-normal min-h-[120px] min-w-0 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected
          ? "border-primary bg-primary/10 ring-1 ring-primary text-foreground"
          : "border-border bg-card text-foreground hover:bg-muted/50",
      )}
    >
      <span className="flex min-w-0 items-center gap-2 pr-5">
        {icon ? (
          <ProviderIcon icon={icon} name={name} size={22} />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded bg-primary/10 text-[11px] font-semibold text-primary"
          >
            {mark}
          </span>
        )}
        <span className="min-w-0 text-sm font-semibold leading-5">{name}</span>
        {selected && (
          <CheckCircle2
            aria-hidden="true"
            className="absolute right-3 top-3 h-4 w-4 text-primary"
          />
        )}
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
    </Button>
  );
}
