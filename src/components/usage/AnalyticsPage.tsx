import type { AppId } from "@/lib/api/types";
import { UsageDashboard } from "./UsageDashboard";
import { LocalUsageSync } from "./LocalUsageSync";
interface Props {
  activeApp?: AppId;
}
export function AnalyticsPage({ activeApp = "claude" }: Props) {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-6 py-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <LocalUsageSync />
        <UsageDashboard key={activeApp} initialApp={activeApp} />
      </div>
    </div>
  );
}
