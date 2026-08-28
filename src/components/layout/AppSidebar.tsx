import { Bell, LayoutGrid, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import hrouterLogo from "@/assets/icons/hrouter.svg";
import { AgentManagerButton } from "@/components/AgentManagerButton";
import { HelpCenterButton } from "@/components/HelpCenterButton";
import { UpdateBadge } from "@/components/UpdateBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  currentView: string;
  onOpenProviders: () => void;
  onOpenAnnouncements: () => void;
  onOpenSettings: () => void;
}

const navItemClass =
  "h-10 w-full justify-start gap-3 rounded-md px-3 text-sm font-medium";
const utilityItemClass = `${navItemClass} border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground`;

export function AppSidebar({
  currentView,
  onOpenProviders,
  onOpenAnnouncements,
  onOpenSettings,
}: AppSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="flex h-full w-full flex-col border-r border-border-default bg-muted/20">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border-default px-4">
        <img src={hrouterLogo} alt="HRouter" className="h-8 w-8 rounded-md" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">HRouter</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {t("navigation.productSubtitle", {
              defaultValue: "Agent 配置中心",
            })}
          </div>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 px-3 py-4">
        <p className="mb-1 px-3 text-[10px] font-semibold text-muted-foreground">
          {t("navigation.main", { defaultValue: "主要功能" })}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenProviders}
          className={cn(
            navItemClass,
            currentView === "providers"
              ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          {t("navigation.providers", { defaultValue: "配置中心" })}
        </Button>

        <AgentManagerButton className={utilityItemClass} showLabel />

        <Button
          type="button"
          variant="ghost"
          onClick={onOpenAnnouncements}
          className={cn(
            navItemClass,
            "relative",
            currentView === "hrouterWeb"
              ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Bell className="h-4 w-4" />
          {t("navigation.announcements", { defaultValue: "公告与服务" })}
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-500" />
        </Button>
      </nav>

      <div className="space-y-1 border-t border-border-default px-3 py-3">
        <UpdateBadge className={utilityItemClass} />
        <HelpCenterButton className={utilityItemClass} showLabel />
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenSettings}
          className={cn(
            navItemClass,
            currentView === "settings"
              ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
          {t("common.settings")}
        </Button>
      </div>
    </aside>
  );
}
