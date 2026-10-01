import { toast } from "sonner";
import { usageWidgetApi } from "@/lib/api/usageWidget";
import {
  BarChart3,
  PanelsTopLeft,
  KeyRound,
  LayoutGrid,
  Network,
  Rows3,
  MessagesSquare,
  Puzzle,
  Sparkles,
  Settings,
} from "lucide-react";
import type { AppId } from "@/lib/api";
import { useTranslation } from "react-i18next";
import hrouterLogo from "@/assets/icons/hrouter.svg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHRouterAccess } from "@/hooks/useHRouterAccess";

type PrimaryView =
  | "hrouter"
  | "workbench"
  | "providers"
  | "profiles"
  | "routes"
  | "usage"
  | "billing"
  | "orders"
  | "apiKeys"
  | "announcements"
  | "sessions"
  | "mcp"
  | "skills"
  | "workspace"
  | "openclawEnv"
  | "openclawTools"
  | "openclawAgents"
  | "hermesMemory";

interface Props {
  activeApp: AppId;
  onHermesWebUI: () => void;
  currentView: string;
  onNavigate: (view: PrimaryView) => void;
  onSettings: () => void;
  onProfile: () => void;
  onFrontend: () => void;
}

const navItemClass =
  "inline-flex h-9 shrink-0 whitespace-nowrap items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors";

export function MagpieTopNav({
  activeApp,
  onHermesWebUI,
  currentView,
  onNavigate,
  onSettings,
}: Props) {
  const { t } = useTranslation();
  const { connected } = useHRouterAccess();
  const item = (view: PrimaryView) =>
    cn(
      navItemClass,
      currentView === view
        ? "bg-foreground text-background shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div
      className="flex h-14 w-full items-center gap-2 sm:gap-4 border-b border-border bg-card px-3 sm:px-5 lg:px-8"
      {...({ "data-tauri-drag-region": true } as any)}
    >
      <div
        className="flex shrink-0 items-center gap-2.5"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <img src={hrouterLogo} alt="HRouter" className="h-7 w-7 rounded-md" />
        <div className="hidden min-[760px]:block">
          <div className="text-sm font-semibold leading-tight">HRouter</div>
          <div className="hidden xl:block text-[10px] text-muted-foreground">
            AI routing workspace
          </div>
        </div>
      </div>

      <nav
        aria-label={t("workspace.navigation", { defaultValue: "主导航" })}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <Button
          variant="ghost"
          size="auto"
          type="button"
          data-tour="workbench"
          aria-current={currentView === "workbench" ? "page" : undefined}
          className={item("workbench")}
          onClick={() => onNavigate("workbench")}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {t("workspace.agents", { defaultValue: "工作台" })}
        </Button>
        <Button
          variant="ghost"
          size="auto"
          type="button"
          data-tour="providers"
          aria-current={currentView === "providers" ? "page" : undefined}
          className={item("providers")}
          onClick={() => onNavigate("providers")}
        >
          <KeyRound className="h-3.5 w-3.5" />
          {t("navigation.providers", { defaultValue: "供应商" })}
        </Button>
        <Button
          variant="ghost"
          size="auto"
          type="button"
          data-tour="profiles"
          aria-current={currentView === "profiles" ? "page" : undefined}
          className={item("profiles")}
          onClick={() => onNavigate("profiles")}
        >
          <Rows3 className="h-3.5 w-3.5" />
          {t("workspace.profiles", { defaultValue: "接入方案" })}
        </Button>
        <Button
          variant="ghost"
          size="auto"
          type="button"
          data-tour="routes"
          aria-current={currentView === "routes" ? "page" : undefined}
          className={item("routes")}
          onClick={() => onNavigate("routes")}
        >
          <Network className="h-3.5 w-3.5" />
          {t("workspace.routes", { defaultValue: "线路策略" })}
        </Button>

        <Button
          variant="ghost"
          size="auto"
          type="button"
          data-tour="usage"
          aria-current={currentView === "usage" ? "page" : undefined}
          className={item("usage")}
          onClick={() => onNavigate("usage")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {t("workspaceUi.analyticsTitle")}
        </Button>
        <Button
          variant="ghost"
          size="auto"
          type="button"
          className={item("sessions")}
          aria-current={currentView === "sessions" ? "page" : undefined}
          onClick={() => onNavigate("sessions")}
        >
          <MessagesSquare className="h-3.5 w-3.5" />
          {t("sessionManager.title")}
        </Button>
        {activeApp === "openclaw" && (
          <>
            <Button
              variant="ghost"
              size="auto"
              type="button"
              className={item("workspace")}
              aria-current={currentView === "workspace" ? "page" : undefined}
              onClick={() => onNavigate("workspace")}
            >
              {t("workspace.manage")}
            </Button>
            <Button
              variant="ghost"
              size="auto"
              type="button"
              className={item("openclawEnv")}
              aria-current={currentView === "openclawEnv" ? "page" : undefined}
              onClick={() => onNavigate("openclawEnv")}
            >
              {t("openclaw.env.title")}
            </Button>
            <Button
              variant="ghost"
              size="auto"
              type="button"
              className={item("openclawTools")}
              aria-current={
                currentView === "openclawTools" ? "page" : undefined
              }
              onClick={() => onNavigate("openclawTools")}
            >
              {t("openclaw.tools.title")}
            </Button>
            <Button
              variant="ghost"
              size="auto"
              type="button"
              className={item("openclawAgents")}
              aria-current={
                currentView === "openclawAgents" ? "page" : undefined
              }
              onClick={() => onNavigate("openclawAgents")}
            >
              {t("openclaw.agents.title")}
            </Button>
          </>
        )}
        <>
          <Button
            variant="ghost"
            size="auto"
            type="button"
            className={item("mcp")}
            aria-current={currentView === "mcp" ? "page" : undefined}
            onClick={() => onNavigate("mcp")}
          >
            <Puzzle className="h-3.5 w-3.5" />
            {t("mcp.title")}
          </Button>
          <Button
            variant="ghost"
            size="auto"
            type="button"
            className={item("skills")}
            aria-current={currentView === "skills" ? "page" : undefined}
            onClick={() => onNavigate("skills")}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("skills.manage")}
          </Button>
          {connected && (
            <Button
              variant="ghost"
              size="auto"
              type="button"
              className={item("hrouter")}
              aria-current={currentView === "hrouter" ? "page" : undefined}
              onClick={() => onNavigate("hrouter")}
            >
              <img src={hrouterLogo} alt="" className="size-4" />
              HRouter
            </Button>
          )}
          {activeApp === "hermes" ? (
            <>
              <Button
                variant="ghost"
                size="auto"
                className={item("hermesMemory")}
                onClick={() => onNavigate("hermesMemory")}
              >
                {t("hermes.memory.title")}
              </Button>
              <Button
                variant="ghost"
                size="auto"
                type="button"
                className={navItemClass}
                onClick={onHermesWebUI}
              >
                {t("hermes.webui.open")}
              </Button>
            </>
          ) : null}
        </>
      </nav>

      <div
        className="flex shrink-0 items-center gap-1"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("usageWidget.open")}
          title={t("usageWidget.open")}
          onClick={() =>
            void usageWidgetApi
              .open(activeApp)
              .catch(() => toast.error(t("usageWidget.windowError")))
          }
        >
          <PanelsTopLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettings}
          aria-label={t("common.settings", { defaultValue: "设置" })}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
