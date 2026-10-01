import { useContext, type ReactNode } from "react";
import { HRouterEmbeddedContext } from "./workspaceContext";
import { LogOut, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hrouterAuthApi } from "@/lib/api/hrouterPlatform";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { cn } from "@/lib/utils";

interface HRouterPageShellProps {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  fitViewport?: boolean;
}

export function HRouterPageShell({
  children,
  onRefresh,
  refreshing,
  fitViewport = false,
}: HRouterPageShellProps) {
  const { t } = useTranslation();
  const embedded = useContext(HRouterEmbeddedContext);

  return (
    <div
      className={cn(
        embedded
          ? "min-h-0"
          : "h-full min-h-0 overscroll-contain bg-muted/20 px-6 py-5 [scrollbar-gutter:stable]",
        fitViewport
          ? "h-full overflow-hidden"
          : embedded
            ? ""
            : "overflow-y-auto",
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-[1500px]",
          fitViewport && "flex h-full min-h-0 flex-col",
        )}
      >
        <div className="mb-4 flex h-8 shrink-0 items-center justify-end gap-2">
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onRefresh}
              disabled={refreshing}
              title={t("common.refresh", { defaultValue: "刷新" })}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
          )}
          {!embedded && <HRouterLogout />}
        </div>
        {children}
      </div>
    </div>
  );
}

export function HRouterLogout() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: hrouterAuthApi.logout,
    onError: () => toast.error(t("hrouterWorkspace.logoutError")),
    onSettled: () => {
      queryClient.removeQueries({ queryKey: ["hrouter-account"] });
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["hrouter-account"] });
      toast.success(
        t("hrouterAccount.loggedOut", { defaultValue: "已退出 HRouter" }),
      );
    },
  });

  if (!session) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      aria-label={t("hrouterAccount.logout")}
    >
      <LogOut className="size-4" />
      {t("hrouterAccount.logout")}
    </Button>
  );
}
