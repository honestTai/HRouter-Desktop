import { ArrowUpRight, Cable, Layers3, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppId } from "@/lib/api";
import type { Provider } from "@/types";
import { Button } from "@/components/ui/button";

const appNames: Record<AppId, string> = {
  claude: "Claude Code",
  "claude-desktop": "Claude Desktop",
  codex: "Codex",
  gemini: "Gemini CLI",
  grokbuild: "Grok Build",
  opencode: "OpenCode",
  openclaw: "OpenClaw",
  hermes: "Hermes",
  pi: "Pi Agent",
  "deepseek-harness": "DeepSeek Harness",
  workbuddy: "WorkBuddy",
};

interface Props {
  appId: AppId;
  providerCount: number;
  currentProvider?: Provider;
  isLoading: boolean;
  isTakeover: boolean;
  onEdit: (provider: Provider) => void;
}

/** Presentation only: provider selection remains owned by the existing switch flow. */
export function ProviderWorkspaceHeader({
  appId,
  providerCount,
  currentProvider,
  isLoading,
  isTakeover,
  onEdit,
}: Props) {
  const { t } = useTranslation();
  const additive = ["opencode", "openclaw", "hermes"].includes(appId);
  return (
    <section className="provider-workspace-header" aria-busy={isLoading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="workspace-eyebrow">{appNames[appId]}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("workspace.providersTitle")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("workspace.providersDescription")}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
          {isLoading
            ? t("workspace.loading")
            : t("workspace.savedCount", { count: providerCount })}
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          {isTakeover ? (
            <Radio className="h-5 w-5" />
          ) : (
            <Cable className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {t(
              additive
                ? "workspace.configuration"
                : isTakeover
                  ? "workspace.routedProvider"
                  : "workspace.selectedProvider",
            )}
          </p>
          <p className="mt-1 truncate text-sm font-medium">
            {isLoading
              ? t("workspace.loading")
              : additive
                ? t("workspace.multipleProviders")
                : currentProvider?.name || t("workspace.noSelection")}
          </p>
        </div>
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {t(isTakeover ? "workspace.localRouting" : "workspace.directConfig")}
        </span>
        {!additive && !isLoading && currentProvider && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(currentProvider)}
          >
            {t("workspace.editConfiguration")}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </section>
  );
}
