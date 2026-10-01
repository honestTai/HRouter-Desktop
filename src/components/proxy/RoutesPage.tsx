import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppId } from "@/lib/api";
import { RoutesPanel } from "@/components/access/AccessWorkbench";
import { cn } from "@/lib/utils";

export const ROUTE_APPS = [
  { id: "claude", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "gemini", label: "Gemini CLI" },
  { id: "grokbuild", label: "Grok Build" },
] as const;
export function RoutesPage({
  activeApp,
  onAppChange,
  onAdd,
}: {
  activeApp: AppId;
  onAppChange: (app: AppId) => void;
  onAdd: (app: AppId) => void;
}) {
  const { t } = useTranslation();
  const supported = ROUTE_APPS.some((item) => item.id === activeApp);
  const [fallback, setFallback] = useState<AppId>("claude");
  const app = supported ? activeApp : fallback;
  return (
    <div className="h-full overflow-y-auto px-6 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="workspace-eyebrow">HROUTER / ROUTES</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {t("workspace.routesTitle")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t("routePolicies.description")}
          </p>
        </header>
        {!supported && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("routePolicies.supported")}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {ROUTE_APPS.map((item) => (
            <button
              type="button"
              aria-pressed={item.id === app}
              key={item.id}
              onClick={() => {
                setFallback(item.id);
                onAppChange(item.id);
              }}
              className={cn(
                "rounded-lg border p-4 text-left text-sm font-medium",
                app === item.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed">
          <h2 className="font-medium">{t("routePolicies.boundary")}</h2>
          <p className="mt-1 text-muted-foreground">
            {t("routePolicies.hint")}
          </p>
        </div>
        <RoutesPanel key={app} app={app} onAdd={() => onAdd(app)} />
      </div>
    </div>
  );
}
