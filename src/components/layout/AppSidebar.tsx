import {
  BarChart3,
  Bell,
  CircleDollarSign,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  ReceiptText,
  Settings,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import hrouterLogo from "@/assets/icons/hrouter.svg";
import { AgentManagerButton } from "@/components/AgentManagerButton";
import { HelpCenterButton } from "@/components/HelpCenterButton";
import { SupportGroupButton } from "@/components/SupportGroupButton";
import { UpdateBadge } from "@/components/UpdateBadge";
import { Button } from "@/components/ui/button";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  currentView: string;
  onOpenDashboard: () => void;
  onOpenUsage: () => void;
  onOpenBilling: () => void;
  onOpenOrders: () => void;
  onOpenApiKeys: () => void;
  onOpenProfile: () => void;
  onOpenFrontend: () => void;
  onOpenProviders: () => void;
  onOpenAnnouncements: () => void;
  onOpenSettings: () => void;
}

const navItemClass =
  "h-9 w-full justify-start gap-3 rounded-md px-3 text-sm font-medium";
const utilityItemClass = `${navItemClass} border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground`;

export function AppSidebar({
  currentView,
  onOpenDashboard,
  onOpenUsage,
  onOpenBilling,
  onOpenOrders,
  onOpenApiKeys,
  onOpenProfile,
  onOpenFrontend,
  onOpenProviders,
  onOpenAnnouncements,
  onOpenSettings,
}: AppSidebarProps) {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const itemClass = (view: string) =>
    cn(
      navItemClass,
      currentView === view
        ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <aside className="flex h-full w-full flex-col border-r border-border-default bg-muted/20">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border-default px-4">
        <img src={hrouterLogo} alt="HRouter" className="h-8 w-8 rounded-md" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">HRouter</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {t("navigation.productSubtitle", { defaultValue: "AI 开发平台" })}
          </div>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <p className="mb-1 px-3 text-[10px] font-semibold text-muted-foreground">
          {t("navigation.hrouterPlatform", { defaultValue: "HRouter 平台" })}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenDashboard}
          className={itemClass("dashboard")}
          data-tour="dashboard"
        >
          <LayoutDashboard className="h-4 w-4" />
          {t("navigation.dashboard", { defaultValue: "仪表盘" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenUsage}
          className={itemClass("usage")}
          data-tour="usage"
        >
          <BarChart3 className="h-4 w-4" />
          {t("navigation.usage", { defaultValue: "使用记录" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenBilling}
          className={itemClass("billing")}
          data-tour="billing"
        >
          <CircleDollarSign className="h-4 w-4" />
          {t("navigation.billing", { defaultValue: "充值支付" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenOrders}
          className={itemClass("orders")}
          data-tour="orders"
        >
          <ReceiptText className="h-4 w-4" />
          {t("navigation.orders", { defaultValue: "个人订单" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenApiKeys}
          className={itemClass("apiKeys")}
          data-tour="apiKeys"
        >
          <KeyRound className="h-4 w-4" />
          {t("navigation.apiKeys", { defaultValue: "API 密钥" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenProfile}
          className={itemClass("profile")}
          data-tour="profile"
        >
          <UserRound className="h-4 w-4" />
          {t("navigation.profile", { defaultValue: "个人中心" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenFrontend}
          className={utilityItemClass}
          data-tour="frontend"
        >
          <ExternalLink className="h-4 w-4" />
          {t("hrouterPlatform.openFrontend", {
            defaultValue: "前台访问",
          })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenAnnouncements}
          className={cn(itemClass("announcements"), "relative")}
        >
          <Bell className="h-4 w-4" />
          {t("navigation.announcements", { defaultValue: "平台公告" })}
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-500" />
        </Button>

        <p className="mb-1 mt-5 px-3 text-[10px] font-semibold text-muted-foreground">
          {t("navigation.localTools", { defaultValue: "本地工具" })}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenProviders}
          className={itemClass("providers")}
          data-tour="providers"
        >
          <LayoutGrid className="h-4 w-4" />
          {t("navigation.providers", { defaultValue: "配置中心" })}
        </Button>
        <div data-tour="agents">
          <AgentManagerButton className={utilityItemClass} showLabel />
        </div>
      </nav>

      <div className="space-y-1 border-t border-border-default px-3 py-3">
        <Button
          type="button"
          variant="ghost"
          onClick={session ? onOpenProfile : onOpenDashboard}
          className={cn(
            navItemClass,
            "mb-2 h-auto min-h-11 border border-border-default bg-background py-2 text-left",
          )}
        >
          {session ? (
            <UserRound className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <LogIn className="h-4 w-4 shrink-0 text-primary" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">
              {session
                ? session.user.username || session.user.email
                : t("hrouterAccount.welcome", { defaultValue: "登录 HRouter" })}
            </span>
            {session && (
              <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">
                {t("hrouterPlatform.balance")} ¥
                {Number(session.user.balance || 0).toFixed(2)}
              </span>
            )}
          </span>
        </Button>
        <UpdateBadge className={utilityItemClass} />
        <div data-tour="help">
          <HelpCenterButton className={utilityItemClass} showLabel />
        </div>
        <SupportGroupButton sidebar />
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenSettings}
          className={itemClass("settings")}
        >
          <Settings className="h-4 w-4" />
          {t("common.settings")}
        </Button>
      </div>
    </aside>
  );
}
