import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accessApi, type EnvironmentTarget } from "@/lib/api/access";
import { providersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractErrorMessage } from "@/utils/errorUtils";

export function EnvironmentTargets() {
  const { t } = useTranslation();

  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["environment-targets"],
    queryFn: accessApi.environmentTargets,
  });
  const claude = useQuery({
    queryKey: ["providers", "claude", "workbench"],
    queryFn: () => providersApi.getAll("claude"),
  });
  const codex = useQuery({
    queryKey: ["providers", "codex", "workbench"],
    queryFn: () => providersApi.getAll("codex"),
  });
  const [draft, setDraft] = useState<EnvironmentTarget[] | null>(null);
  const [preview, setPreview] = useState<{
    fingerprint: string;
    files: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [backup, setBackup] = useState("");
  const rows = draft ?? query.data ?? [];
  const change = (next: EnvironmentTarget[]) => {
    setDraft(next);
    setPreview(null);
    setBackup("");
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <h2 className="font-semibold">
        {t("accessWorkbench.independentWindowsWslTargets", {
          defaultValue: "Windows / WSL 独立配置目标",
        })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t(
          "accessWorkbench.saveMultipleEnvironmentsWithDifferentProvidersEnterAnExisting",
          {
            defaultValue:
              "保存多个环境，每个环境可选择不同供应商。填入已存在的配置目录，例如 Windows 的 .codex，或 \\\\wsl.localhost\\Ubuntu\\home\\用户名\\.codex。预览后一次写入全部目标；保留目标环境的 Hooks、MCP 和自定义配置。不会启动 WSL 或变更当前接管状态。",
          },
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          "accessWorkbench.apiKeyProvidersOnlyCodexUsesProviderAuthenticationWithout",
          {
            defaultValue:
              "仅支持 API Key 接入。Codex 使用供应商认证，不同步 Windows 本地模型目录文件，也不修改 auth.json；WSL 需使用可访问的上游地址。本机已被代理接管的目录需先关闭接管。",
          },
        )}
      </p>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded border p-3">
          <Input
            aria-label={t("accessWorkbench.environmentName", {
              defaultValue: "环境名称 {{value0}}",
              value0: index + 1,
            })}
            placeholder="Windows / Ubuntu"
            value={row.name}
            disabled={busy}
            onChange={(e) =>
              change(
                rows.map((r, i) =>
                  i === index ? { ...r, name: e.target.value } : r,
                ),
              )
            }
          />
          <select
            aria-label={t("accessWorkbench.environmentApp", {
              defaultValue: "环境应用 {{value0}}",
              value0: index + 1,
            })}
            className="h-10 border rounded bg-background px-3"
            value={row.app}
            disabled={busy}
            onChange={(e) =>
              change(
                rows.map((r, i) =>
                  i === index
                    ? { ...r, app: e.target.value, providerId: "" }
                    : r,
                ),
              )
            }
          >
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
          </select>
          <Input
            aria-label={t("accessWorkbench.environmentDirectory", {
              defaultValue: "配置目录 {{value0}}",
              value0: index + 1,
            })}
            placeholder={t("accessWorkbench.absoluteConfigurationDirectory", {
              defaultValue: "配置目录绝对路径",
            })}
            value={row.directory}
            disabled={busy}
            onChange={(e) =>
              change(
                rows.map((r, i) =>
                  i === index ? { ...r, directory: e.target.value } : r,
                ),
              )
            }
          />
          <select
            aria-label={t("accessWorkbench.environmentProvider", {
              defaultValue: "环境供应商 {{value0}}",
              value0: index + 1,
            })}
            className="h-10 border rounded bg-background px-3"
            value={row.providerId}
            disabled={busy}
            onChange={(e) =>
              change(
                rows.map((r, i) =>
                  i === index ? { ...r, providerId: e.target.value } : r,
                ),
              )
            }
          >
            <option value="">
              {t("accessWorkbench.selectApiKeyProvider", {
                defaultValue: "选择 API Key 供应商",
              })}
            </option>
            {Object.values(
              (row.app === "claude" ? claude.data : codex.data) ?? {},
            )
              .filter((p) => p.category !== "official")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => change(rows.filter((_, i) => i !== index))}
          >
            {t("accessWorkbench.removeEnvironment", {
              defaultValue: "移除环境",
            })}
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy || query.isLoading || !!query.error}
          onClick={() =>
            change([
              ...rows,
              { name: "", app: "codex", directory: "", providerId: "" },
            ])
          }
        >
          {t("accessWorkbench.addEnvironment", { defaultValue: "添加环境" })}
        </Button>
        <Button
          variant="outline"
          disabled={busy || draft === null}
          onClick={() =>
            void run(async () => {
              await accessApi.saveEnvironmentTargets(rows);
              await query.refetch();
              setDraft(null);
            })
          }
        >
          {t("accessWorkbench.saveTargets", { defaultValue: "保存目标" })}
        </Button>
        <Button
          disabled={busy || rows.length === 0}
          onClick={() =>
            void run(async () =>
              setPreview(await accessApi.previewEnvironmentTargets(rows)),
            )
          }
        >
          {t("accessWorkbench.previewAllTargets", {
            defaultValue: "预览全部目标",
          })}
        </Button>
      </div>
      {preview && (
        <div className="space-y-2">
          <p className="text-sm">
            {t("accessWorkbench.theseFilesWillBeWrittenAfterSavingALocal", {
              defaultValue: "将写入以下文件，写入前保存本机恢复快照：",
            })}
          </p>
          <ul className="text-xs break-all">
            {preview.files.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setBackup(
                  await accessApi.applyEnvironmentTargets(
                    rows,
                    preview.fingerprint,
                  ),
                );
                setPreview(null);
                await queryClient.invalidateQueries({
                  queryKey: ["providers"],
                });
                await providersApi.updateTrayMenu();
              })
            }
          >
            {t("accessWorkbench.confirmDeploymentToAllTargets", {
              defaultValue: "确认写入全部目标",
            })}
          </Button>
        </div>
      )}
      {backup && (
        <p role="status" className="text-sm break-all">
          {t("accessWorkbench.deployedRecoverySnapshotSavedAt", {
            defaultValue: "已写入，恢复快照保存在：",
          })}
          {backup}
        </p>
      )}
      {(error || query.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || extractErrorMessage(query.error)}
        </p>
      )}
    </section>
  );
}
