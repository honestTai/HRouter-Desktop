import { useState } from "react";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppId } from "@/lib/api";
import { FailoverQueueManager } from "./FailoverQueueManager";
import { cn } from "@/lib/utils";

const ROUTE_APPS: Array<{ id: AppId; label: string; description: string }> = [
  { id: "claude", label: "Claude Code", description: "终端开发 Agent" },
  { id: "codex", label: "Codex", description: "保持会话稳定" },
  { id: "gemini", label: "Gemini CLI", description: "Google 模型线路" },
  { id: "opencode", label: "OpenCode", description: "多模型工作区" },
];

export function RoutesPage({ activeApp }: { activeApp: AppId }) {
  const { t } = useTranslation();
  const [app, setApp] = useState<AppId>(
    ROUTE_APPS.some((item) => item.id === activeApp) ? activeApp : "claude",
  );
  return (
    <div className="h-full overflow-y-auto px-6 pb-12 pt-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <div>
          <p className="workspace-eyebrow">HROUTER ROUTES</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("workspace.routesTitle", { defaultValue: "线路策略" })}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            为每个 Agent
            设置主线路和备用线路。线路切换只影响请求路由，不会改变会话、历史记录或
            Agent 配置。
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ROUTE_APPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setApp(item.id)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                app === item.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-medium">
                  {ROUTE_APPS.find((item) => item.id === app)?.label} 的线路队列
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  请求失败时按队列顺序切换，优先保留当前会话的路由。
                </p>
              </div>
            </div>
            <div className="mt-6">
              <FailoverQueueManager appType={app} />
            </div>
          </section>
          <aside className="h-fit rounded-lg border border-border bg-card p-5">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="mt-4 font-medium">切换安全边界</h2>
            <ul className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                只切换 Provider / Route，不重建会话。
              </li>
              <li className="flex gap-2">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                故障转移沿用供应商排序。
              </li>
              <li className="flex gap-2">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                关闭策略不会删除任何配置。
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
