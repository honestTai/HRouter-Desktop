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
  onOpenWorkbench: () => void;
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
  "h-9 w-full justify-start gap-3 rounded-md px-3 text-[13px] font-medium";
const utilityItemClass = `${navItemClass} border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted hover:text-foreground`;

export function AppSidebar({
  onOpenWorkbench,
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
        ? "bg-card text-foreground shadow-sm ring-1 ring-border hover:bg-card hover:text-foreground"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <aside className="flex h-full w-full flex-col border-r border-border-default bg-muted/40">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <img src={hrouterLogo} alt="HRouter" className="h-7 w-7 rounded-md" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">HRouter</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {t("navigation.productSubtitle", { defaultValue: "AI 开发平台" })}
          </div>
        </div>
      </div>

      <nav
        aria-label={t("workspace.navigation")}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
      >
        <p className="mb-2 px-3 text-[11px] font-medium text-muted-foreground">
          {t("workspace.localWorkspace")}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenWorkbench}
          aria-current={currentView === "workbench" ? "page" : undefined}
          className={itemClass("workbench")}
        >
          <LayoutGrid className="h-4 w-4" />
          {t("accessWorkbench.accessWorkbench", { defaultValue: "接入工作台" })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenProviders}
          aria-current={currentView === "providers" ? "page" : undefined}
          className={itemClass("providers")}
        >
          <KeyRound className="h-4 w-4" />
          {t("accessWorkbench.providerConfiguration", {
            defaultValue: "供应商配置",
          })}
        </Button>
        <div className="my-3 border-t border-border-default" />
        <p className="mb-1 px-3 text-[11px] font-medium text-muted-foreground">
          {t("navigation.hrouterPlatform", { defaultValue: "HRouter 平台" })}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenDashboard}
          aria-current={currentView === "dashboard" ? "page" : undefined}
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
          aria-current={currentView === "usage" ? "page" : undefined}
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
          aria-current={currentView === "billing" ? "page" : undefined}
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
          aria-current={currentView === "orders" ? "page" : undefined}
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
          aria-current={currentView === "apiKeys" ? "page" : undefined}
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
          aria-current={currentView === "profile" ? "page" : undefined}
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

        <p className="mb-1 mt-5 px-3 text-[11px] font-medium text-muted-foreground">
          {t("navigation.localTools", { defaultValue: "本地工具" })}
        </p>
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
          aria-current={currentView === "settings" ? "page" : undefined}
          className={itemClass("settings")}
        >
          <Settings className="h-4 w-4" />
          {t("common.settings")}
        </Button>
      </div>
    </aside>
  );
}
