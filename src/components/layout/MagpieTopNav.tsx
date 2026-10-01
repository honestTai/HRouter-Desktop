import {
  BarChart3,
  ExternalLink,
  KeyRound,
  LayoutGrid,
  Network,
  Rows3,
  Settings,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import hrouterLogo from "@/assets/icons/hrouter.svg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHRouterSession } from "@/hooks/useHRouterSession";

type PrimaryView =
  | "workbench"
  | "providers"
  | "profiles"
  | "routes"
  | "usage"
  | "dashboard";

interface Props {
  currentView: string;
  onNavigate: (view: PrimaryView) => void;
  onSettings: () => void;
  onProfile: () => void;
  onFrontend: () => void;
}

const navItemClass =
  "inline-flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors";

export function MagpieTopNav({
  currentView,
  onNavigate,
  onSettings,
  onProfile,
  onFrontend,
}: Props) {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const item = (view: PrimaryView) =>
    cn(
      navItemClass,
      currentView === view
        ? "bg-foreground text-background shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div
      className="flex h-14 w-full items-center gap-6 border-b border-border bg-card px-5 lg:px-8"
      {...({ "data-tauri-drag-region": true } as any)}
    >
      <div
        className="flex shrink-0 items-center gap-2.5"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <img src={hrouterLogo} alt="HRouter" className="h-7 w-7 rounded-md" />
        <div className="hidden min-[760px]:block">
          <div className="text-sm font-semibold leading-tight">HRouter</div>
          <div className="text-[10px] text-muted-foreground">
            AI routing workspace
          </div>
        </div>
      </div>

      <nav
        aria-label={t("workspace.navigation", { defaultValue: "主导航" })}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <button
          type="button"
          className={item("workbench")}
          onClick={() => onNavigate("workbench")}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {t("workspace.agents", { defaultValue: "工作台" })}
        </button>
        <button
          type="button"
          className={item("providers")}
          onClick={() => onNavigate("providers")}
        >
          <KeyRound className="h-3.5 w-3.5" />
          {t("navigation.providers", { defaultValue: "供应商" })}
        </button>
        <button
          type="button"
          className={item("profiles")}
          onClick={() => onNavigate("profiles")}
        >
          <Rows3 className="h-3.5 w-3.5" />
          {t("workspace.profiles", { defaultValue: "接入方案" })}
        </button>
        <button
          type="button"
          className={item("routes")}
          onClick={() => onNavigate("routes")}
        >
          <Network className="h-3.5 w-3.5" />
          {t("workspace.routes", { defaultValue: "线路策略" })}
        </button>
        <button
          type="button"
          className={item("dashboard")}
          onClick={() => onNavigate("dashboard")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {t("navigation.dashboard", { defaultValue: "概览" })}
        </button>
        <button
          type="button"
          className={item("usage")}
          onClick={() => onNavigate("usage")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {t("navigation.usage", { defaultValue: "用量" })}
        </button>
      </nav>

      <div
        className="flex shrink-0 items-center gap-1"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onFrontend}
          className="hidden lg:inline-flex"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t("hrouterPlatform.openFrontend", { defaultValue: "前台" })}
        </Button>
        <Button
          variant={session ? "ghost" : "outline"}
          size="sm"
          onClick={onProfile}
          className="max-w-40"
        >
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {session
              ? session.user.username || session.user.email
              : t("hrouterAccount.welcome", { defaultValue: "登录 HRouter" })}
          </span>
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
