import { useEffect } from "react";
import { APP_IDS } from "@/config/appConfig";
import { useQuery } from "@tanstack/react-query";
import { isMac } from "@/lib/platform";
import { usageWidgetApi } from "@/lib/api/usageWidget";
import type { AppId } from "@/lib/api/types";

/** Keep WidgetKit updated even when the floating monitor is closed. */
export function NativeWidgetSync({ app }: { app: AppId }) {
  useEffect(() => {
    if (isMac()) void usageWidgetApi.selectAgent(app).catch(() => undefined);
  }, [app]);
  // Fixed WidgetKit selections must keep updating even when the workbench shows
  // another Agent. Queries are shared with any consumers in this webview.
  if (!isMac()) return null;
  return (
    <>
      {APP_IDS.map((id) => (
        <NativeAgentSync key={id} app={id} />
      ))}
    </>
  );
}

function NativeAgentSync({ app }: { app: AppId }) {
  const snapshot = useQuery({
    queryKey: ["usage-widget", app],
    queryFn: () => usageWidgetApi.snapshot(app),
    enabled: isMac(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  const data = snapshot.isError ? undefined : snapshot.data;
  useQuery({
    queryKey: [
      "usage-widget-finance",
      app,
      data?.providerId,
      data?.providerRevision,
    ],
    queryFn: () =>
      usageWidgetApi.finance(app, data!.providerId!, data!.providerRevision!),
    enabled:
      isMac() &&
      !!data?.financeEnabled &&
      !!data.providerId &&
      !!data.providerRevision,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  return null;
}
