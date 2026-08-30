import { useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { hrouterAccountApi } from "@/lib/api/hrouterPlatform";

const SUMMARY_REFRESH_INTERVAL_MS = 60_000;

export function useHRouterTraySummary() {
  const session = useHRouterSession();
  const hadSession = useRef(false);
  const runsInTauri = isTauri();
  const enabled = runsInTauri && Boolean(session);

  const profile = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "profile"],
    queryFn: hrouterAccountApi.profile,
    enabled,
    refetchInterval: SUMMARY_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
  const dashboard = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "dashboard-stats"],
    queryFn: hrouterAccountApi.dashboardStats,
    enabled,
    refetchInterval: SUMMARY_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!runsInTauri) return;
    if (!session) {
      if (!hadSession.current) return;
      hadSession.current = false;
      void invoke("update_hrouter_tray_summary", { summary: null }).catch(
        (error) => {
          console.debug("[HRouterTray] Failed to clear summary", error);
        },
      );
      return;
    }
    hadSession.current = true;
    if (!dashboard.data) return;

    void invoke("update_hrouter_tray_summary", {
      summary: {
        todayUsage: Number(dashboard.data.today_actual_cost || 0),
        balance: Number(profile.data?.balance ?? session.user.balance ?? 0),
      },
    }).catch((error) => {
      console.debug("[HRouterTray] Failed to sync summary", error);
    });
  }, [
    dashboard.data?.today_actual_cost,
    profile.data?.balance,
    runsInTauri,
    session,
  ]);
}
