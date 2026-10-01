import { useQuery } from "@tanstack/react-query";
import { isMac } from "@/lib/platform";
import { usageWidgetApi } from "@/lib/api/usageWidget";
import type { AppId } from "@/lib/api/types";

/** Keep WidgetKit updated even when the floating monitor is closed. */
export function NativeWidgetSync({ app }: { app: AppId }) {
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
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  return null;
}
