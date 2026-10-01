import type { AppId } from "@/lib/api/types";
import { UsageDashboard } from "./UsageDashboard";
import { LocalUsageSync } from "./LocalUsageSync";
export type AnalyticsSource = "local" | "hrouter";
interface Props {
  activeApp?: AppId;
  source: AnalyticsSource;
  onSourceChange: (source: AnalyticsSource) => void;
  onLogin: () => void;
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
