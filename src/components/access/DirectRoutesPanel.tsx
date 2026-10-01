import { invalidateAgentContext } from "@/lib/query/agentContext";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { providersApi, type AppId } from "@/lib/api";
import { APP_ICON_MAP } from "@/config/appConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { extractErrorMessage } from "@/utils/errorUtils";

/** Agents with native provider config can select real direct routes without a proxy takeover. */
export function DirectRoutesPanel({
  app,
  onAdd,
}: {
  app: AppId;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const additive = ["opencode", "openclaw", "hermes"].includes(app);
  const state = useQuery({
    queryKey: ["direct-routes", app],
    queryFn: async () => {
      const providers = await providersApi.getAll(app);
      const current = await providersApi.getCurrent(app);
      const enabled =
        app === "opencode"
          ? await providersApi.getOpenCodeLiveProviderIds()
          : app === "openclaw"
            ? await providersApi.getOpenClawLiveProviderIds()
            : app === "hermes"
              ? await providersApi.getHermesLiveProviderIds()
              : [current];
      return { providers: Object.values(providers), enabled };
    },
  });
  const apply = async () => {
    if (!pendingId) return;
    setBusy(true);
    setError("");
    try {
      const result = await providersApi.switch(pendingId, app);
      if (result.warnings?.length) setError(result.warnings.join("\n"));
      setPendingId(null);
      await Promise.all([state.refetch(), invalidateAgentContext(client, app)]);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">
              {APP_ICON_MAP[app].label} · {t("routePolicies.directTitle")}
            </h2>
            <Badge variant="secondary">{t("routePolicies.directMode")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              additive
                ? "routePolicies.additiveHint"
                : "routePolicies.directHint",
            )}
          </p>
          <Button onClick={onAdd}>{t("accessWorkbench.addProvider")}</Button>
        </CardContent>
      </Card>
      {state.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
      {(state.isError || error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || extractErrorMessage(state.error)}
        </p>
      )}
      {state.data?.providers.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">
          {t("routePolicies.noProviders")}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {state.data?.providers.map((p) => {
          const active = state.data.enabled.includes(p.id);
          return (
            <Card
              key={p.id}
              className={active ? "border-primary bg-primary/5" : ""}
            >
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <span className="min-w-0 break-words font-medium">
                  {p.name}
                </span>
                <Button
                  variant={active ? "secondary" : "outline"}
                  disabled={busy || active}
                  onClick={() => {
                    setError("");
                    setPendingId(p.id);
                  }}
                >
                  {active ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {t(active ? "routePolicies.inUse" : "routePolicies.useRoute")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ConfirmDialog
        isOpen={pendingId != null}
        title={t("routePolicies.useRoute")}
        message={t(
          additive ? "routePolicies.additiveHint" : "routePolicies.directHint",
        )}
        pending={busy}
        error={error || undefined}
        variant="info"
        onConfirm={() => void apply()}
        onCancel={() => setPendingId(null)}
      />
    </div>
  );
}
