import { useMemo, useState } from "react";
import {
  Check,
  FolderOpen,
  FolderPlus,
  Loader2,
  SquareTerminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ClaudeIcon, CodexIcon } from "@/components/BrandIcons";
import hrouterLogo from "@/assets/icons/hrouter.svg";
import { settingsApi, type WorkspaceTool } from "@/lib/api";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "@/utils/errorUtils";
import { EmbeddedTerminalPane } from "./EmbeddedTerminalPane";

const directoryName = (path: string): string => {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? path;
};

export function TerminalWorkspace() {
  const { t } = useTranslation();
  const [selectedTool, setSelectedTool] = useState<WorkspaceTool>("terminal");
  const [workspacePaths, setWorkspacePaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState("");
  const [isPickingDirectory, setIsPickingDirectory] = useState(false);

  const tools = useMemo(
    () => [
      {
        id: "claude" as const,
        label: "Claude Code",
        icon: <ClaudeIcon size={16} />,
        accent: "text-orange-600 dark:text-orange-400",
      },
      {
        id: "codex" as const,
        label: "Codex CLI",
        icon: <CodexIcon size={16} />,
        accent: "text-neutral-900 dark:text-neutral-100",
      },
      {
        id: "terminal" as const,
        label: t("terminalWorkspace.systemTerminal", {
          defaultValue: "Terminal",
        }),
        icon: <SquareTerminal className="h-4 w-4" />,
        accent: "text-emerald-600 dark:text-emerald-400",
      },
    ],
    [t],
  );
  const activeTool = tools.find((tool) => tool.id === selectedTool) ?? tools[2];

  const pickWorkspace = async () => {
    if (isPickingDirectory) return;
    setIsPickingDirectory(true);
    try {
      const selectedPath = await settingsApi.pickDirectory(
        activePath || undefined,
      );
      if (!selectedPath) return;
      setWorkspacePaths((current) =>
        current.includes(selectedPath) ? current : [...current, selectedPath],
      );
      setActivePath(selectedPath);
    } catch (error) {
      const detail = extractErrorMessage(error);
      toast.error(
        t("terminalWorkspace.pickDirectoryFailed", {
          defaultValue: "工作目录选择失败",
        }),
        detail ? { description: detail } : undefined,
      );
    } finally {
      setIsPickingDirectory(false);
    }
  };

  return (
    <main className="flex h-screen min-h-0 overflow-hidden bg-[#f7f9f8] text-[#1a1e1b] dark:bg-[#111512] dark:text-[#eef2ef]">
      <aside className="flex w-[252px] shrink-0 flex-col border-r border-black/[0.08] bg-[#fbfcfb] dark:border-white/10 dark:bg-[#171b18]">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-black/[0.06] px-4 dark:border-white/[0.08]">
          <img
            src={hrouterLogo}
            alt="HRouter"
            className="h-8 w-8 rounded-lg shadow-sm"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#151a17] dark:text-white">
              HRouter
            </div>
            <div className="text-[10px] font-medium uppercase text-blue-600/75 dark:text-blue-300/75">
              Workspace
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <section aria-labelledby="workspace-tools-title">
            <h2
              id="workspace-tools-title"
              className="px-2 text-[10px] font-semibold uppercase text-black/40 dark:text-white/40"
            >
              {t("terminalWorkspace.tools", { defaultValue: "工具" })}
            </h2>
            <div className="mt-2 space-y-1">
              {tools.map((tool) => {
                const selected = selectedTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    aria-label={tool.label}
                    onClick={() => setSelectedTool(tool.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-left text-xs font-medium transition-colors",
                      selected
                        ? "bg-blue-500/10 text-blue-700 ring-1 ring-inset ring-blue-500/15 dark:bg-blue-400/10 dark:text-blue-200"
                        : "text-black/65 hover:bg-black/[0.045] hover:text-black/90 dark:text-white/65 dark:hover:bg-white/[0.06] dark:hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.05]",
                        tool.accent,
                      )}
                    >
                      {tool.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {tool.label}
                    </span>
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-7" aria-labelledby="workspace-paths-title">
            <div className="flex items-center justify-between px-2">
              <h2
                id="workspace-paths-title"
                className="text-[10px] font-semibold uppercase text-black/40 dark:text-white/40"
              >
                {t("terminalWorkspace.workspaces", {
                  defaultValue: "工作目录",
                })}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void pickWorkspace()}
                disabled={isPickingDirectory}
                className="h-7 w-7 rounded-md"
                title={t("terminalWorkspace.addWorkspace", {
                  defaultValue: "添加工作目录",
                })}
              >
                {isPickingDirectory ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FolderPlus className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              {workspacePaths.map((path) => {
                const selected = activePath === path;
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => setActivePath(path)}
                    aria-pressed={selected}
                    title={path}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                      selected
                        ? "bg-emerald-500/10 text-emerald-800 ring-1 ring-inset ring-emerald-500/15 dark:text-emerald-200"
                        : "text-black/60 hover:bg-black/[0.045] dark:text-white/60 dark:hover:bg-white/[0.06]",
                    )}
                  >
                    <FolderOpen className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">
                        {directoryName(path)}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] opacity-55">
                        {path}
                      </span>
                    </span>
                  </button>
                );
              })}
              {workspacePaths.length === 0 && (
                <button
                  type="button"
                  onClick={() => void pickWorkspace()}
                  className="flex h-10 w-full items-center gap-2 rounded-md border border-dashed border-black/10 px-2.5 text-left text-[11px] text-black/40 hover:border-blue-500/30 hover:bg-blue-500/[0.04] hover:text-blue-700 dark:border-white/10 dark:text-white/40 dark:hover:border-blue-400/30 dark:hover:text-blue-300"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  {t("terminalWorkspace.addWorkspace", {
                    defaultValue: "添加工作目录",
                  })}
                </button>
              )}
            </div>
          </section>
        </div>

        <footer className="flex h-10 shrink-0 items-center gap-2 border-t border-black/[0.06] px-4 text-[10px] text-black/40 dark:border-white/[0.08] dark:text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t("terminalWorkspace.nativePtyLabel", {
            defaultValue: "OS Native PTY",
          })}
        </footer>
      </aside>

      <section className="min-w-0 flex-1">
        {activePath ? (
          <EmbeddedTerminalPane
            title={activeTool.label}
            subtitle={activePath}
            tool={selectedTool}
            cwd={activePath}
          />
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-8 text-center">
            <img
              src={hrouterLogo}
              alt="HRouter"
              className="h-16 w-16 rounded-2xl shadow-lg shadow-emerald-950/15"
            />
            <h1 className="mt-5 text-lg font-semibold text-[#171c19] dark:text-white">
              HRouter Workspace
            </h1>
            <p className="mt-1 text-xs text-black/45 dark:text-white/45">
              Claude Code · Codex CLI · Terminal
            </p>
            <Button
              type="button"
              onClick={() => void pickWorkspace()}
              disabled={isPickingDirectory}
              className="mt-6 gap-2 bg-[#1769e0] px-4 hover:bg-[#125ac2]"
            >
              {isPickingDirectory ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderOpen className="h-4 w-4" />
              )}
              {t("terminalWorkspace.chooseWorkspace", {
                defaultValue: "选择工作目录",
              })}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
