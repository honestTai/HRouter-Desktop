import { AgentPicker } from "@/components/common/AgentPicker";
import { APP_IDS, APP_ICON_MAP } from "@/config/appConfig";
import { useTranslation } from "react-i18next";
import type { AppId } from "@/lib/api";
import { RoutesPanel } from "@/components/access/AccessWorkbench";

export const ROUTE_APPS = APP_IDS.map((id) => ({
  id,
  label: APP_ICON_MAP[id].label,
}));
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
  const app = activeApp;
  const supportsFailover = ["claude", "codex", "gemini", "grokbuild"].includes(
    app,
  );
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
        <AgentPicker
          value={app}
          supported={ROUTE_APPS.map((item) => item.id)}
          onChange={(next) => {
            onAppChange(next);
          }}
        />
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed">
          <h2 className="font-medium">{t("routePolicies.boundary")}</h2>
          <p className="mt-1 text-muted-foreground">
            {t(
              supportsFailover
                ? "routePolicies.hint"
                : "routePolicies.directHint",
            )}
          </p>
        </div>
        <RoutesPanel key={app} app={app} onAdd={() => onAdd(app)} />
      </div>
    </div>
  );
}
