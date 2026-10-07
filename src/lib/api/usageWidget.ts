import { invoke } from "@tauri-apps/api/core";
import type { AppId } from "./types";
import type { UsageSummary } from "@/types/usage";
import type { UsageData } from "@/types";
export interface WidgetSnapshot {
  app: AppId;
  providerId?: string;
  providerName?: string;
  providerRevision?: string;
  financeEnabled: boolean;
  summary: UsageSummary;
  tokensPerSecond?: number;
  speedSamples: number;
  speedMeasuredAt?: number;
  measuredAt: number;
}
export interface WidgetFinance {
  totalSpent?: number;
  tokensPerMinute?: number;
  todayCost?: number;
  unit?: string;
  plans: UsageData[];
}
export const usageWidgetApi = {
  open: (app: AppId) => invoke<void>("open_usage_widget", { app }),
  selectAgent: (app: AppId) =>
    invoke<void>("select_usage_widget_agent", { app }),
  snapshot: (app: AppId) =>
    invoke<WidgetSnapshot>("get_usage_widget_snapshot", { app }),
  finance: (app: AppId, providerId: string, providerRevision: string) =>
    invoke<WidgetFinance>("get_usage_widget_finance", {
      app,
      providerId,
      providerRevision,
    }),
};
