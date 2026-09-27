import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accessApi } from "@/lib/api/access";
import { providersApi, type AppId } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractErrorMessage } from "@/utils/errorUtils";

const panel = "rounded-xl border border-border bg-card p-5 space-y-3";
const select = "h-10 rounded-md border bg-background px-3 text-sm";

export function ReliabilityControls({ app }: { app: AppId }) {
  const { t } = useTranslation();

  const client = useQueryClient();
  const providers = useQuery({
    queryKey: ["providers", app, "workbench"],
    queryFn: () => providersApi.getAll(app),
  });
  const routes = useQuery({
    queryKey: ["model-routes", app],
    queryFn: () => accessApi.modelRoutes(app),
  });
  const [draft, setDraft] = useState<
    { model: string; providers: string[] }[] | null
  >(null);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = providers.data?.[id];
  const rows = draft ?? routes.data ?? [];
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const choices = Object.values(providers.data ?? {});
  return (
    <div className="space-y-4">
      <section className={panel}>
        <h3 className="font-semibold">
          {t("accessWorkbench.choosePrimaryAndBackupProvidersByModel", {
            defaultValue: "按模型选择主备供应商",
          })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("accessWorkbench.matchTheClientSModelIdExactlyAndTry", {
            defaultValue:
              "精确匹配客户端请求的模型名，按顺序尝试线路；未匹配时使用应用原有线路。每个 Key 建成独立供应商后可加入同一条主备链。仅在本地代理接管时生效，不改变全局当前供应商。尝试次数仍受路由设置中的重试上限约束。",
          })}
        </p>
        {rows.map((row, index) => (
          <div key={index} className="space-y-2 rounded border p-3">
            <Input
              aria-label={t("accessWorkbench.routeModel", {
                defaultValue: "路由模型 {{value0}}",
                value0: index + 1,
              })}
              value={row.model}
              placeholder={t("accessWorkbench.clientModelId", {
                defaultValue: "客户端模型 ID",
              })}
              disabled={busy}
              onChange={(e) =>
                setDraft(
                  rows.map((r, i) =>
                    i === index ? { ...r, model: e.target.value } : r,
                  ),
                )
              }
            />
            {row.providers.map((providerId, position) => (
              <div className="flex gap-2" key={position}>
                <span className="self-center text-sm">P{position + 1}</span>
                <select
                  aria-label={t("accessWorkbench.routePosition", {
                    defaultValue: "路由 {{value0}} 线路 {{value1}}",
                    value0: index + 1,
                    value1: position + 1,
                  })}
                  className={select}
                  value={providerId}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft(
                      rows.map((r, i) =>
                        i === index
                          ? {
                              ...r,
                              providers: r.providers.map((p, j) =>
                                j === position ? e.target.value : p,
                              ),
                            }
                          : r,
                      ),
                    )
                  }
                >
                  <option value="">
                    {t("accessWorkbench.selectProviderKey", {
                      defaultValue: "选择供应商 / Key",
                    })}
                  </option>
                  {choices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    setDraft(
                      rows.map((r, i) =>
                        i === index
                          ? {
                              ...r,
                              providers: r.providers.filter(
                                (_, j) => j !== position,
                              ),
                            }
                          : r,
                      ),
                    )
                  }
                >
                  {t("accessWorkbench.removeRoute", {
                    defaultValue: "移除线路",
                  })}
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                setDraft(
                  rows.map((r, i) =>
                    i === index ? { ...r, providers: [...r.providers, ""] } : r,
                  ),
                )
              }
            >
              {t("accessWorkbench.addBackup", { defaultValue: "添加备用" })}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDraft(rows.filter((_, i) => i !== index))}
            >
              {t("accessWorkbench.deleteRule", { defaultValue: "删除规则" })}
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy || routes.isLoading || !!routes.error}
            onClick={() => setDraft([...rows, { model: "", providers: [""] }])}
          >
            {t("accessWorkbench.addModelRule", {
              defaultValue: "添加模型规则",
            })}
          </Button>
          <Button
            disabled={busy || draft === null}
            onClick={() =>
              void run(async () => {
                await accessApi.setModelRoutes(app, rows);
                await routes.refetch();
                setDraft(null);
              })
            }
          >
            {t("accessWorkbench.saveModelRoutes", {
              defaultValue: "保存模型路由",
            })}
          </Button>
        </div>
      </section>
      <section className={panel}>
        <h3 className="font-semibold">
          {t("accessWorkbench.providerCompatibilityOptions", {
            defaultValue: "供应商兼容选项",
          })}
        </h3>
        <select
          className={select}
          aria-label={t("accessWorkbench.providerForCompatibilityOptions", {
            defaultValue: "兼容选项供应商",
          })}
          value={id}
          onChange={(e) => setId(e.target.value)}
          disabled={busy}
        >
          <option value="">
            {t("accessWorkbench.selectProvider", {
              defaultValue: "选择供应商",
            })}
          </option>
          {choices.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selected && (
          <>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.meta?.standardHttpTransport ?? false}
                disabled={busy}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void run(async () => {
                    await accessApi.setCompatibility(
                      app,
                      id,
                      selected.meta?.codexSessionCompatibility ?? false,
                      checked,
                    );
                    await client.invalidateQueries({ queryKey: ["providers"] });
                  });
                }}
              />
              {t(
                "accessWorkbench.standardHttpTransportForCompatibleEndpointsThatWorkDirectly",
                {
                  defaultValue:
                    "标准 HTTP 传输（适用于直连正常、代理 Connect / SendRequest 失败的兼容端点）",
                },
              )}
            </label>
            {app === "codex" && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.meta?.codexSessionCompatibility ?? false}
                  disabled={busy}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    void run(async () => {
                      await accessApi.setCompatibility(
                        app,
                        id,
                        checked,
                        selected.meta?.standardHttpTransport ?? false,
                      );
                      await client.invalidateQueries({
                        queryKey: ["providers"],
                      });
                    });
                  }}
                />
                {t("accessWorkbench.crossProviderSessionCompatibility", {
                  defaultValue: "跨供应商会话兼容",
                })}
              </label>
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                "accessWorkbench.compatibilityChangesOnlyTheProxiedRequestCopyRemoveOld",
                {
                  defaultValue:
                    "会话兼容仅修改代理中的请求副本，清除旧服务端 ID 和私有推理，保留可见消息与工具调用，并使用当前供应商配置的模型。无法恢复只有服务端引用的历史，也不保证模型自身会持续执行工具任务。以上选项仅对本地代理生效。",
                },
              )}
            </p>
          </>
        )}
      </section>
      {(error || routes.error || providers.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || extractErrorMessage(routes.error || providers.error)}
        </p>
      )}
    </div>
  );
}
