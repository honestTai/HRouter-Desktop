import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowUpCircle,
  Bot,
  CheckCircle2,
  Download,
  Loader2,
  Monitor,
  RefreshCw,
  Terminal,
  X,
} from "lucide-react";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ToolUpgradeConfirmDialog } from "@/components/settings/ToolUpgradeConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { settingsApi } from "@/lib/api";
import type {
  CodexGuiStatus,
  ToolInstallationReport,
} from "@/lib/api/settings";
import { isUpdateAvailable } from "@/lib/version";
import { extractErrorMessage } from "@/utils/errorUtils";
import { cn } from "@/lib/utils";

const AGENT_TOOLS = [
  { name: "claude", label: "Claude Code", icon: "claude" },
  { name: "codex", label: "Codex", icon: "openai" },
  { name: "gemini", label: "Gemini CLI", icon: "gemini" },
  { name: "grok", label: "Grok Build", icon: "grok" },
  { name: "opencode", label: "OpenCode", icon: "opencode" },
  { name: "openclaw", label: "OpenClaw", icon: "openclaw" },
  { name: "hermes", label: "Hermes", icon: "hermes" },
] as const;

type AgentToolName = (typeof AGENT_TOOLS)[number]["name"];
type ToolLifecycleAction = "install" | "update";

interface AgentToolVersion {
  name: string;
  version: string | null;
  latest_version: string | null;
  error: string | null;
  installed_but_broken: boolean;
  env_type: "windows" | "wsl" | "macos" | "linux" | "unknown";
  wsl_distro: string | null;
}

const EMPTY_GUI_STATUS: CodexGuiStatus = {
  supported: false,
  installed: false,
  version: null,
};

function toolDisplayName(name: string): string {
  return AGENT_TOOLS.find((tool) => tool.name === name)?.label ?? name;
}

interface AgentManagerButtonProps {
  className?: string;
  showLabel?: boolean;
}

export function AgentManagerButton({
  className,
  showLabel = false,
}: AgentManagerButtonProps = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [toolVersions, setToolVersions] = useState<AgentToolVersion[]>([]);
  const [guiStatus, setGuiStatus] = useState<CodexGuiStatus>(EMPTY_GUI_STATUS);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [runningTools, setRunningTools] = useState<
    Partial<Record<AgentToolName, ToolLifecycleAction>>
  >({});
  const [isLaunchingGui, setIsLaunchingGui] = useState(false);
  const [pendingUpgrade, setPendingUpgrade] = useState<{
    toolName: AgentToolName;
    plans: ToolInstallationReport[];
  } | null>(null);

  const versionByName = useMemo(
    () => new Map(toolVersions.map((tool) => [tool.name, tool])),
    [toolVersions],
  );

  const hasAgentUpdates = useMemo(
    () =>
      toolVersions.some((tool) =>
        isUpdateAvailable(tool.version, tool.latest_version),
      ),
    [toolVersions],
  );

  const loadStatuses = useCallback(async () => {
    setIsLoading(true);
    try {
      const [toolResults, nextGuiStatus] = await Promise.all([
        Promise.all(
          AGENT_TOOLS.map(async ({ name }) => {
            try {
              return await settingsApi.getToolVersions([name]);
            } catch (error) {
              console.error(`[AgentManager] Failed to load ${name}`, error);
              return [];
            }
          }),
        ),
        settingsApi.getCodexGuiStatus().catch((error) => {
          console.error("[AgentManager] Failed to load Codex GUI", error);
          return EMPTY_GUI_STATUS;
        }),
      ]);
      setToolVersions(toolResults.flat());
      setGuiStatus(nextGuiStatus);
    } catch (error) {
      console.error("[AgentManager] Failed to load statuses", error);
      toast.error(t("settings.agentStatusLoadFailed"));
    } finally {
      setHasLoaded(true);
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open && !hasLoaded && !isLoading) {
      void loadStatuses();
    }
  }, [hasLoaded, isLoading, loadStatuses, open]);

  const replaceToolVersion = (tool: AgentToolVersion) => {
    setToolVersions((previous) => {
      const next = previous.filter((item) => item.name !== tool.name);
      return [...next, tool];
    });
  };

  const executeToolAction = async (
    toolName: AgentToolName,
    action: ToolLifecycleAction,
  ) => {
    const previous = versionByName.get(toolName);
    setRunningTools((current) => ({ ...current, [toolName]: action }));
    try {
      await settingsApi.runToolLifecycleAction([toolName], action);
      const [updated] = await settingsApi.getToolVersions([toolName]);
      if (updated) replaceToolVersion(updated);

      if (!updated?.version) {
        toast.warning(t("settings.toolActionInstalledNotRunnable"), {
          description:
            updated?.error || previous?.error || t("settings.toolNotRunnable"),
          closeButton: true,
        });
      } else if (
        action === "update" &&
        previous?.version === updated.version &&
        isUpdateAvailable(updated.version, updated.latest_version)
      ) {
        toast.warning(t("settings.toolActionVersionUnchangedTitle"), {
          description: t("settings.toolActionVersionUnchanged", {
            version: updated.version,
            latest: updated.latest_version || t("common.unknown"),
          }),
          closeButton: true,
        });
      } else {
        toast.success(
          t("settings.toolActionDone", {
            count: 1,
            action:
              action === "install"
                ? t("settings.toolInstall")
                : t("settings.toolUpdate"),
          }),
          { closeButton: true },
        );
      }
    } catch (error) {
      console.error(`[AgentManager] Failed to ${action} ${toolName}`, error);
      toast.error(t("settings.toolActionFailed"), {
        description: extractErrorMessage(error) || undefined,
        closeButton: true,
      });
    } finally {
      setRunningTools((current) => {
        const next = { ...current };
        delete next[toolName];
        return next;
      });
    }
  };

  const handleToolAction = async (
    toolName: AgentToolName,
    action: ToolLifecycleAction,
  ) => {
    if (action === "update") {
      try {
        const plans = await settingsApi.probeToolInstallations([toolName]);
        const needsConfirmation = plans.filter(
          (plan) => plan.needs_confirmation,
        );
        if (needsConfirmation.length > 0) {
          setPendingUpgrade({ toolName, plans: needsConfirmation });
          return;
        }
      } catch (error) {
        console.error(
          `[AgentManager] Upgrade preflight failed for ${toolName}`,
          error,
        );
        toast.error(t("settings.toolDiagnoseFailed"), {
          description: extractErrorMessage(error) || undefined,
          closeButton: true,
        });
        return;
      }
    }

    await executeToolAction(toolName, action);
  };

  const handleGuiInstaller = async () => {
    setIsLaunchingGui(true);
    try {
      await settingsApi.launchCodexGuiInstaller();
      toast.success(t("settings.codexGuiInstallerOpened"), {
        closeButton: true,
      });
    } catch (error) {
      console.error(
        "[AgentManager] Failed to launch Codex GUI installer",
        error,
      );
      toast.error(t("settings.codexGuiInstallerFailed"), {
        description: extractErrorMessage(error) || undefined,
        closeButton: true,
      });
    } finally {
      setIsLaunchingGui(false);
    }
  };

  const isAnyActionRunning =
    Object.keys(runningTools).length > 0 || isLaunchingGui;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          title={t("settings.agentInstallUpdate")}
          aria-label={t("settings.agentInstallUpdate")}
          className={cn(
            "relative h-8 gap-1.5 rounded-md border-emerald-500/25 bg-emerald-500/5 px-2.5 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300",
            className,
          )}
        >
          <Bot className="h-4 w-4" />
          <span className={showLabel ? "inline" : "hidden 2xl:inline"}>
            {t("settings.agentInstallUpdate")}
          </span>
          {hasAgentUpdates && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-red-500" />
          )}
        </Button>

        <DialogContent className="max-w-4xl overflow-hidden">
          <DialogHeader className="relative pr-14">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Bot className="h-5 w-5" />
              </span>
              {t("settings.agentInstallUpdate")}
            </DialogTitle>
            <DialogDescription>
              {t("settings.agentInstallUpdateHint")}
            </DialogDescription>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 h-8 w-8"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {t("settings.commandLineAgents")}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {t("settings.agentCount", { count: AGENT_TOOLS.length })}
              </span>
            </div>

            <div className="overflow-hidden rounded-md border border-border-default">
              <div className="grid grid-cols-[minmax(180px,1fr)_140px_140px_100px] items-center gap-3 border-b border-border-default bg-muted/30 px-4 py-2 text-[11px] font-medium text-muted-foreground">
                <span>{t("settings.agentName")}</span>
                <span>{t("settings.currentVersion")}</span>
                <span>{t("settings.latestVersion")}</span>
                <span className="text-right">{t("settings.agentAction")}</span>
              </div>
              {AGENT_TOOLS.map((agent) => {
                const tool = versionByName.get(agent.name);
                const runningAction = runningTools[agent.name];
                const hasUpdate = isUpdateAvailable(
                  tool?.version,
                  tool?.latest_version,
                );
                const action: ToolLifecycleAction | null = !tool?.version
                  ? "install"
                  : hasUpdate
                    ? "update"
                    : null;

                return (
                  <div
                    key={agent.name}
                    className="grid min-h-14 grid-cols-[minmax(180px,1fr)_140px_140px_100px] items-center gap-3 border-b border-border-default px-4 py-2.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-default bg-background">
                        <ProviderIcon
                          icon={agent.icon}
                          name={agent.label}
                          size={19}
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {agent.label}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 py-0 text-[9px] font-medium text-muted-foreground"
                          >
                            CLI
                          </Badge>
                          {tool?.env_type && tool.env_type !== "unknown" && (
                            <span className="text-[10px] uppercase text-muted-foreground">
                              {tool.env_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="truncate font-mono text-xs">
                      {isLoading && !tool
                        ? t("common.loading")
                        : tool?.version || t("common.notInstalled")}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {isLoading && !tool
                        ? "-"
                        : tool?.latest_version || t("common.unknown")}
                    </span>
                    <div className="flex justify-end">
                      {isLoading && !tool ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : action ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={action === "install" ? "outline" : "default"}
                          onClick={() => handleToolAction(agent.name, action)}
                          disabled={isAnyActionRunning || isLoading}
                          className="h-7 min-w-20 gap-1.5 text-xs"
                        >
                          {runningAction ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : action === "install" ? (
                            <Download className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpCircle className="h-3.5 w-3.5" />
                          )}
                          {action === "install"
                            ? t("settings.toolInstall")
                            : t("settings.toolUpdate")}
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("settings.toolReady")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mb-3 mt-6 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                {t("settings.desktopAgents")}
              </h3>
            </div>

            <div className="flex min-h-20 items-center gap-4 rounded-md border border-blue-500/25 bg-blue-500/5 px-4 py-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-500/20 bg-background">
                <ProviderIcon icon="openai" name="Codex GUI" size={22} />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-[4px] border border-border-default bg-background">
                  <Monitor className="h-2.5 w-2.5" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Codex GUI</span>
                  <Badge
                    variant="outline"
                    className="h-5 border-blue-500/25 bg-blue-500/5 px-1.5 py-0 text-[10px] text-blue-600 dark:text-blue-400"
                  >
                    Windows
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {guiStatus.supported
                    ? guiStatus.installed
                      ? t("settings.codexGuiInstalled", {
                          version: guiStatus.version || t("common.unknown"),
                        })
                      : t("settings.codexGuiNotInstalled")
                    : t("settings.codexGuiWindowsOnly")}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("settings.codexGuiInstallerHint")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleGuiInstaller}
                disabled={
                  !guiStatus.supported || isAnyActionRunning || isLoading
                }
                className="h-8 min-w-24 gap-1.5 text-xs"
              >
                {isLaunchingGui ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : guiStatus.installed ? (
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {guiStatus.installed
                  ? t("settings.toolUpdate")
                  : t("settings.toolInstall")}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("common.close")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={loadStatuses}
              disabled={isLoading || isAnyActionRunning}
              className="gap-1.5"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              {t("common.refresh")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToolUpgradeConfirmDialog
        isOpen={pendingUpgrade !== null}
        plans={pendingUpgrade?.plans ?? []}
        displayName={toolDisplayName}
        onConfirm={() => {
          const pending = pendingUpgrade;
          setPendingUpgrade(null);
          if (pending) {
            void executeToolAction(pending.toolName, "update");
          }
        }}
        onCancel={() => setPendingUpgrade(null)}
      />
    </>
  );
}
