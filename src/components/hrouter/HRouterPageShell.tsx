import type { ReactNode } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hrouterAuthApi } from "@/lib/api/hrouterPlatform";
import { useHRouterSession } from "@/hooks/useHRouterSession";

interface HRouterPageShellProps {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function HRouterPageShell({
  children,
  onRefresh,
  refreshing,
}: HRouterPageShellProps) {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: hrouterAuthApi.logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["hrouter-account"] });
      toast.success(
        t("hrouterAccount.loggedOut", { defaultValue: "已退出 HRouter" }),
      );
    },
  });

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain bg-muted/20 px-6 py-5 [scrollbar-gutter:stable]">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-4 flex h-8 items-center justify-end gap-2">
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
          {session && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              title={t("hrouterAccount.logout", { defaultValue: "退出登录" })}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
