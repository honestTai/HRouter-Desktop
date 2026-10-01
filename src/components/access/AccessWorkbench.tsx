import i18n from "i18next";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  ShieldCheck,
  Waypoints,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type { Provider } from "@/types";
import { providersApi, type AppId } from "@/lib/api";
import {
  accessApi,
  type DiagnosticReport,
  type ImportCandidate,
  type SwitchPreview,
} from "@/lib/api/access";
import { proxyApi } from "@/lib/api/proxy";
import { hrouterAccountApi } from "@/lib/api/hrouterPlatform";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { FailoverQueueManager } from "@/components/proxy/FailoverQueueManager";
import { UsageDashboard } from "@/components/usage/UsageDashboard";
import { BillingReconciliation } from "./BillingReconciliation";
import { ReliabilityControls } from "./ReliabilityControls";
import { EnvironmentTargets } from "./EnvironmentTargets";
import { UsageRepair } from "./UsageRepair";
import { QuotaSummary } from "./QuotaSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { extractErrorMessage } from "@/utils/errorUtils";

const selectClass =
  "h-10 rounded-md border border-border bg-background px-3 text-sm min-w-0";
const panelClass =
  "workbench-panel rounded-lg border border-border bg-card p-6 space-y-4";
function failure(error: unknown) {
  return (
    extractErrorMessage(error) ||
    i18n.t("accessWorkbench.operationFailedPleaseTryAgain", {
      defaultValue: "操作失败，请重试。",
    })
  );
}
function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive break-words">
      {failure(error)}
    </p>
  ) : null;
}

interface Props {
  onAdd: (mode: "general" | "hrouter", app: AppId) => void;
  onProviders: () => void;
  onHRouterUsage: () => void;
  onHRouterAccount: () => void;
}

export function AccessWorkbench(props: Props) {
  const { t } = useTranslation();

  const [app, setApp] = useState<AppId>("claude");
  const [tab, setTab] = useState("connect");
  return (
    <div className="h-full overflow-y-auto px-6 lg:px-8 pb-10 pt-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="workspace-eyebrow">HROUTER DESKTOP</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {t("accessWorkbench.connectYourModelService", {
                defaultValue: "接入你的模型服务",
              })}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "accessWorkbench.connectOfficialServicesYourOwnEndpointsOrThirdParty",
                {
                  defaultValue:
                    "官方服务、自建端点、第三方中转，统一接入。通用功能无需登录。",
                },
              )}
            </p>
          </div>
          <select
            aria-label={t("accessWorkbench.workbenchApp", {
              defaultValue: "工作台应用",
            })}
            className={selectClass}
            value={app}
            onChange={(e) => setApp(e.target.value as AppId)}
          >
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
          </select>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="workbench-tabs mb-6 flex h-auto w-full flex-wrap justify-start gap-x-5 gap-y-1 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="connect">
              {t("accessWorkbench.connect", { defaultValue: "开放接入" })}
            </TabsTrigger>
            <TabsTrigger value="diagnostics">
              {t("accessWorkbench.connectionCheck", {
                defaultValue: "接入体检",
              })}
            </TabsTrigger>
            <TabsTrigger value="protection">
              {t("accessWorkbench.configurationProtection", {
                defaultValue: "配置保护",
              })}
            </TabsTrigger>
            <TabsTrigger value="routes">
              {t("accessWorkbench.primaryAndBackupRoutes", {
                defaultValue: "主备线路",
              })}
            </TabsTrigger>
            <TabsTrigger value="costs">
              {t("accessWorkbench.costsAndBilling", {
                defaultValue: "费用与账单",
              })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="connect">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <section className={panelClass}>
                  <Activity className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">
                    {t("accessWorkbench.useAnExistingService", {
                      defaultValue: "使用已有服务",
                    })}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "accessWorkbench.chooseAnOfficialPresetOrEnterACompatibleService",
                      {
                        defaultValue:
                          "从官方预设开始，或填写任意兼容服务的 Base URL 和 Key。其他 Agent 可在配置中心选择。",
                      },
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => props.onAdd("general", app)}>
                      {t("accessWorkbench.addProvider", {
                        defaultValue: "添加供应商",
                      })}
                    </Button>
                    <Button variant="outline" onClick={props.onProviders}>
                      {t("accessWorkbench.providers", {
                        defaultValue: "配置中心",
                      })}
                    </Button>
                  </div>
                </section>
                <section className={panelClass}>
                  <Wallet className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">
                    {t("accessWorkbench.quickHrouterSetup", {
                      defaultValue: "HRouter 快捷接入",
                    })}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "accessWorkbench.discoverModelsWithAnExistingHrouterKeyAccountServices",
                      {
                        defaultValue:
                          "已有 HRouter Key 可直接识别模型。账号服务提供余额和服务端消费记录。",
                      },
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => props.onAdd("hrouter", app)}
                    >
                      {t("accessWorkbench.addHrouterKey", {
                        defaultValue: "添加 HRouter Key",
                      })}
                    </Button>
                    <Button variant="ghost" onClick={props.onHRouterAccount}>
                      {t("accessWorkbench.aboutSignInToHrouter", {
                        defaultValue: "了解 / 登录 HRouter",
                      })}{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </section>
              </div>
              <ImportPanel />
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  [
                    "diagnostics",
                    t("accessWorkbench.testRealRequests", {
                      defaultValue: "验证真实调用",
                    }),
                    t(
                      "accessWorkbench.checkTheCatalogTextResponsesStreamingAndToolCalls",
                      { defaultValue: "检查目录、响应、流式与工具调用。" },
                    ),
                  ],
                  [
                    "protection",
                    t("accessWorkbench.protectLocalSettings", {
                      defaultValue: "保护本地配置",
                    }),
                    t(
                      "accessWorkbench.keepCustomFieldsPreviewChangesAndSaveASnapshot",
                      {
                        defaultValue: "保留自定义字段，切换前预览并留存快照。",
                      },
                    ),
                  ],
                  [
                    "routes",
                    t("accessWorkbench.setUpBackupRoutes", {
                      defaultValue: "设置备用线路",
                    }),
                    t(
                      "accessWorkbench.failOverInYourChosenOrderNoChannelsAre",
                      {
                        defaultValue:
                          "按你选择的顺序故障转移，不自动添加渠道。",
                      },
                    ),
                  ],
                ].map(([value, title, desc]) => (
                  <button
                    key={value}
                    onClick={() => setTab(value)}
                    className="rounded-xl border border-border p-4 text-left hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium">{title} →</p>
                    <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="diagnostics">
            <DiagnosticsPanel key={app} app={app} />
          </TabsContent>
          <TabsContent value="protection">
            <div className="space-y-5">
              <ProtectionPanel key={app} app={app} />
              <EnvironmentTargets />
            </div>
          </TabsContent>
          <TabsContent value="routes">
            <div className="space-y-5">
              <ReliabilityControls key={app} app={app} />
              <QuotaSummary key={`quota-${app}`} app={app} />
              <RoutesPanel
                key={app}
                app={app}
                onAdd={() => props.onAdd("general", app)}
              />
            </div>
          </TabsContent>
          <TabsContent value="costs">
            <div className="space-y-5">
              <UsageRepair />
              <CostsPanel
                onHRouterUsage={props.onHRouterUsage}
                onHRouterAccount={props.onHRouterAccount}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ImportPanel() {
  const { t } = useTranslation();

  const queryClient = useQueryClient();
  const [path, setPath] = useState("");
  const [items, setItems] = useState<ImportCandidate[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const choose = async () => {
    setError(null);
    setBusy(true);
    try {
      const chosen = await open({
        title: t("accessWorkbench.selectACcSwitchDatabase", {
          defaultValue: "选择 CC Switch 数据库",
        }),
        multiple: false,
        filters: [
          {
            name: t("accessWorkbench.sqliteDatabase", {
              defaultValue: "SQLite 数据库",
            }),
            extensions: ["db"],
          },
        ],
      });
      if (!chosen || Array.isArray(chosen)) return;
      setPath(chosen);
      setItems(null);
      setSelected([]);
      const candidates = await accessApi.previewImport(chosen);
      setItems(candidates);
      setSelected(
        candidates.filter((i) => !i.exists).map((i) => `${i.app}:${i.id}`),
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const importSelected = async () => {
    setBusy(true);
    setError(null);
    try {
      const count = await accessApi.importProviders(path, selected);
      toast.success(
        t("accessWorkbench.importedProviders", {
          defaultValue: "已导入 {{value0}} 个供应商；尚未启用。",
          value0: count,
        }),
      );
      setItems(await accessApi.previewImport(path));
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ["providers"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={panelClass}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Download className="h-4 w-4" />
        {t("accessWorkbench.importFromCcSwitch", {
          defaultValue: "从 CC Switch 迁移",
        })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("accessWorkbench.selectCcSwitchCcSwitchDbAndPreviewIt", {
          defaultValue:
            "选择 ~/.cc-switch/cc-switch.db，只读预览后导入所选供应商。不覆盖已有条目，不激活配置，不迁移提示词、Skills、用量脚本或托管 OAuth 登录态。",
        })}
      </p>
      <Button variant="outline" disabled={busy} onClick={() => void choose()}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("accessWorkbench.selectDatabaseAndPreview", {
          defaultValue: "选择数据库并预览",
        })}
      </Button>
      {path && (
        <p className="break-all text-xs text-muted-foreground">{path}</p>
      )}
      <ErrorMessage error={error} />
      {items && (
        <>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {items.length === 0 && (
              <p className="text-sm">
                {t("accessWorkbench.noProvidersAvailableToImport", {
                  defaultValue: "未发现可迁移供应商。",
                })}
              </p>
            )}
            {items.map((item) => {
              const key = `${item.app}:${item.id}`;
              return (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    disabled={busy || item.exists}
                    checked={selected.includes(key)}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked
                          ? [...s, key]
                          : s.filter((k) => k !== key),
                      )
                    }
                  />
                  <span className="flex-1">
                    {item.name}{" "}
                    <span className="text-muted-foreground">· {item.app}</span>
                  </span>
                  {item.exists && (
                    <span className="text-xs">
                      {t("accessWorkbench.alreadyExistsSkipped", {
                        defaultValue: "已存在，跳过",
                      })}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <Button
            disabled={busy || !selected.length}
            onClick={() => void importSelected()}
          >
            {t("accessWorkbench.importSelectedItems", {
              defaultValue: "导入所选 {{total}} 项",
              total: selected.length,
            })}
          </Button>
        </>
      )}
    </section>
  );
}

function useProviders(app: AppId) {
  return useQuery({
    queryKey: ["providers", app, "workbench"],
    queryFn: () => providersApi.getAll(app),
  });
}
function ProviderSelect({
  providers,
  value,
  onChange,
  disabled,
}: {
  providers: Provider[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <select
      className={`${selectClass} w-full`}
      aria-label={t("accessWorkbench.selectProvider", {
        defaultValue: "选择供应商",
      })}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">
        {t("accessWorkbench.selectProvider", { defaultValue: "选择供应商" })}
      </option>
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
function DiagnosticsPanel({ app }: { app: AppId }) {
  const { t } = useTranslation();

  const providers = useProviders(app);
  const candidates = Object.values(providers.data ?? {}).filter(
    (p) =>
      p.category !== "official" &&
      !["github_copilot", "codex_oauth", "xai_oauth"].includes(
        p.meta?.providerType ?? "",
      ),
  );
  const [id, setId] = useState("");
  const [model, setModel] = useState("");
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      setReport(await accessApi.diagnose(app, id, model, paid));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={panelClass}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Activity className="h-4 w-4" />
        {t("accessWorkbench.connectionCheck", { defaultValue: "接入体检" })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("accessWorkbench.sendFixedTestContentDirectlyToTheSelectedApi", {
          defaultValue:
            "直接向所选 API 端点发送固定测试内容，不读取你的对话。目录检测不生成文本；完整体检额外发送 最多 4 次模型请求。结果不改变主备线路的健康状态。",
        })}
      </p>
      <ErrorMessage error={providers.error} />
      <ProviderSelect
        providers={candidates}
        value={id}
        disabled={busy}
        onChange={(v) => {
          setId(v);
          setReport(null);
          setModel("");
          setPaid(false);
        }}
      />
      {!providers.isLoading && !candidates.length && (
        <p className="text-sm text-muted-foreground">
          {t("accessWorkbench.firstAddAnApiKeyProviderUnderConnectVerify", {
            defaultValue:
              "请先在开放接入中添加 API Key 供应商。官方 OAuth 登录请在客户端内验证。",
          })}
        </p>
      )}
      <div>
        <label htmlFor="probe-model" className="text-sm">
          {t("accessWorkbench.modelId", { defaultValue: "模型 ID" })}
        </label>
        <Input
          id="probe-model"
          list="probe-models"
          className="mt-2"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
          }}
          disabled={busy}
          placeholder={t(
            "accessWorkbench.checkTheModelCatalogThenSelectAModelFor",
            { defaultValue: "先检测模型目录，再选择模型进行完整体检" },
          )}
        />
        <datalist id="probe-models">
          {report?.models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          className="mt-1"
          type="checkbox"
          checked={paid}
          disabled={busy}
          onChange={(e) => setPaid(e.target.checked)}
        />
        <span>
          {t(
            "accessWorkbench.testTextStreamingToolCallsAndToolResultContinuation",
            {
              defaultValue:
                "执行普通响应、流式、工具调用及工具结果续传测试。将按所选服务商规则计费，每次请求的输出上限为 128 tokens。",
            },
          )}
        </span>
      </label>
      <Button
        disabled={busy || !id || (paid && !model.trim())}
        onClick={() => void run()}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("accessWorkbench.checkingUpTo45SecondsPerStep", {
              defaultValue: "体检中（每项最多 45 秒）",
            })}
          </>
        ) : paid ? (
          t("accessWorkbench.runFullCheck", { defaultValue: "开始完整体检" })
        ) : (
          t("accessWorkbench.checkModelCatalog", {
            defaultValue: "检测模型目录",
          })
        )}
      </Button>
      <ErrorMessage error={error} />
      {report && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {new Date(report.testedAt * 1000).toLocaleString()} ·{" "}
            {report.protocol}
            {report.model && ` · ${report.model}`}
          </p>
          {report.steps.map((step) => (
            <div key={step.name} className="rounded-lg border p-4">
              <div className="flex justify-between gap-2">
                <span className="text-sm font-medium">{step.name}</span>
                <span
                  className={
                    step.status === "passed"
                      ? "text-xs text-emerald-600"
                      : step.status === "failed"
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                  }
                >
                  {step.status === "passed"
                    ? t("accessWorkbench.passed", { defaultValue: "通过" })
                    : step.status === "failed"
                      ? t("accessWorkbench.failed", { defaultValue: "未通过" })
                      : t("accessWorkbench.notChecked", {
                          defaultValue: "未检测",
                        })}{" "}
                  · {step.elapsedMs} ms
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.message}
              </p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {t(
              "accessWorkbench.aPassConfirmsThisProtocolRequestSucceededNotCoding",
              {
                defaultValue:
                  "通过代表本次协议请求成功，不代表编程能力、长任务稳定性或客户端配置已生效。客户端模型目录仍受版本、目录格式和重启状态影响。",
              },
            )}
          </p>
        </div>
      )}
    </section>
  );
}

function ProtectionPanel({ app }: { app: AppId }) {
  const { t } = useTranslation();

  const lite = useQuery({
    queryKey: ["lite-mode"],
    queryFn: accessApi.liteMode,
  });
  const syncScope = useQuery({
    queryKey: ["providers-only-sync"],
    queryFn: accessApi.providersOnlySync,
  });
  const promptProtection = useQuery({
    queryKey: ["prompt-protection", app],
    queryFn: () => accessApi.promptProtection(app),
  });
  const queryClient = useQueryClient();
  const providers = useProviders(app);
  const protection = useQuery({
    queryKey: ["access-protection", app],
    queryFn: () => accessApi.protection(app),
  });
  const snapshots = useQuery({
    queryKey: ["access-snapshots", app],
    queryFn: () => accessApi.snapshots(app),
  });
  const takeover = useQuery({
    queryKey: ["proxy", "takeover"],
    queryFn: proxyApi.getProxyTakeoverStatus,
    refetchInterval: 5000,
  });
  const [id, setId] = useState("");
  const [preview, setPreview] = useState<SwitchPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const routed = takeover.data?.[app] ?? false;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["providers"] }),
      snapshots.refetch(),
    ]);
    await providersApi.updateTrayMenu().catch(() => undefined);
  };
  return (
    <div className="space-y-5">
      <section className={panelClass}>
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" />
          {t("accessWorkbench.localConfigurationProtection", {
            defaultValue: "本机配置保护",
          })}
        </h2>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={lite.data ?? false}
            disabled={busy || lite.isLoading || !!lite.error}
            onChange={(e) => {
              const enabled = e.target.checked;
              void run(async () => {
                await accessApi.setLiteMode(enabled);
                await Promise.all([
                  lite.refetch(),
                  protection.refetch(),
                  promptProtection.refetch(),
                  syncScope.refetch(),
                ]);
              });
            }}
          />
          {t(
            "accessWorkbench.liteModeManageOnlyClaudeCodexConnectionFieldsDisable",
            {
              defaultValue:
                "Lite 模式：Claude / Codex 仅管理接入字段；停用 MCP、Skills、插件、提示词管理及通用配置回填",
            },
          )}
        </label>
        <p className="text-xs text-muted-foreground">
          {t(
            "accessWorkbench.liteModeAlsoEnforcesConfigProtectionPromptProtectionAnd",
            {
              defaultValue:
                "Lite 模式同时强制配置保护、提示词保护和仅供应商同步。不会删除已有扩展；关闭后恢复各独立开关设置。其他客户端仍使用原有供应商写入方式。",
            },
          )}
        </p>
        <ErrorMessage error={lite.error} />
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={syncScope.data ?? false}
            disabled={busy || syncScope.isLoading || !!syncScope.error}
            onChange={(e) => {
              const enabled = e.target.checked;
              void run(async () => {
                await accessApi.setProvidersOnlySync(enabled);
                await syncScope.refetch();
              });
            }}
          />
          {t("accessWorkbench.webdavS3SyncProvidersOnlyForAllAppsExclude", {
            defaultValue:
              "WebDAV / S3 仅同步供应商配置（所有应用；不上传或应用提示词、Skills、MCP、统计及其他设置）",
          })}
        </label>
        <p className="text-xs text-muted-foreground">
          {t("accessWorkbench.useASeparateRemoteDirectoryOrS3PrefixInstall", {
            defaultValue:
              "请为此模式使用独立的远端同步目录或 S3 前缀，并在各设备安装支持此模式的 HRouter 版本并开启此开关；旧版客户端无法识别仅供应商快照。Claude / Codex 会过滤非接入字段，其他客户端保留完整供应商条目。",
          })}
        </p>
        <ErrorMessage error={syncScope.error} />
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={promptProtection.data ?? false}
            disabled={
              busy || promptProtection.isLoading || !!promptProtection.error
            }
            onChange={(e) => {
              const enabled = e.target.checked;
              void run(async () => {
                await accessApi.setPromptProtection(app, enabled);
                await promptProtection.refetch();
              });
            }}
          />
          {t("accessWorkbench.protectPromptFile", {
            defaultValue: "不管理本机 {{file}}（独立于云端配置）",
            file: app === "codex" ? "AGENTS.md" : "CLAUDE.md",
          })}
        </label>
        <ErrorMessage error={promptProtection.error} />
        <p className="text-sm text-muted-foreground">
          {t(
            "accessWorkbench.directSwitchingReplacesApiModelAndAuthenticationFieldsWhile",
            {
              defaultValue:
                "开启后，直连切换只替换 API、模型及认证配置，保留本机 Hooks、权限、自定义环境变量和 MCP。切换前保存本地快照。此开关不随云端数据库同步。",
            },
          )}
        </p>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={protection.data ?? false}
            disabled={busy || protection.isLoading || !!protection.error}
            onChange={(e) => {
              const enabled = e.target.checked;
              void run(async () => {
                await accessApi.setProtection(app, enabled);
                setPreview(null);
                await protection.refetch();
              });
            }}
          />
          <span>
            {t("accessWorkbench.protectAppConfiguration", {
              defaultValue: "保护 {{app}} 的本地自定义配置",
              app: app === "claude" ? "Claude Code" : "Codex",
            })}
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          {t(
            "accessWorkbench.existingInstallsRetainTheirPreviousBehaviorUntilProtectionIs",
            {
              defaultValue:
                "现有安装默认保持原行为，请主动开启。保护仅作用于供应商配置写入；手动编辑 MCP、提示词以及云同步仍遵循其各自设置。代理接管期间不提供直连快照恢复。",
            },
          )}
        </p>
        <ErrorMessage error={protection.error || takeover.error} />
        <ProviderSelect
          providers={Object.values(providers.data ?? {})}
          value={id}
          disabled={busy}
          onChange={(v) => {
            setId(v);
            setPreview(null);
          }}
        />
        <Button
          variant="outline"
          disabled={busy || !id || routed || !takeover.data}
          onClick={() =>
            void run(async () => setPreview(await accessApi.preview(app, id)))
          }
        >
          {t("accessWorkbench.previewSwitchChanges", {
            defaultValue: "预览切换影响",
          })}
        </Button>
        {routed && (
          <p className="text-sm text-muted-foreground">
            {t("accessWorkbench.localRoutingIsActiveDisableRoutingForThisApp", {
              defaultValue:
                "当前处于本地路由模式，请先在主备线路中关闭接管，再预览直连配置。",
            })}
          </p>
        )}
        {preview && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">
              {preview.protected
                ? t("accessWorkbench.protectionEnabled", {
                    defaultValue: "保护模式已开启",
                  })
                : t(
                    "accessWorkbench.protectionDisabledTheFullProviderConfigurationWillBeWritten",
                    { defaultValue: "保护模式未开启，将按供应商完整配置写入" },
                  )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                "accessWorkbench.changedFieldsAreShownWithoutKeyValuesClientAdapters",
                {
                  defaultValue:
                    "以下是配置字段差异，不显示密钥值。生成的模型目录和认证清理由客户端适配器完成。",
                },
              )}
            </p>
            {preview.files.map((p) => (
              <p key={p} className="break-all text-xs text-muted-foreground">
                {p}
              </p>
            ))}
            <ul className="list-inside list-disc text-sm">
              {preview.fields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {!preview.fields.length && (
              <p className="text-sm">
                {t("accessWorkbench.noVisibleFieldChanges", {
                  defaultValue: "没有可见字段差异。",
                })}
              </p>
            )}
            <Button
              disabled={busy || !preview.protected}
              onClick={() =>
                void run(async () => {
                  const result = await accessApi.switch(
                    app,
                    id,
                    preview.fingerprint,
                  );
                  setPreview(null);
                  await refresh();
                  if (result.warnings?.length)
                    toast.warning(
                      t(
                        "accessWorkbench.switchedButSomeAdditionalStepsFailedCheckTheConfiguration",
                        {
                          defaultValue:
                            "已切换，但部分附加操作未完成，请检查配置与快照。",
                        },
                      ),
                    );
                  else
                    toast.success(
                      t(
                        "accessWorkbench.switchedAndSavedASnapshotRestartTheClientIf",
                        {
                          defaultValue: "已切换并保存快照，请按需重启客户端。",
                        },
                      ),
                    );
                })
              }
            >
              {t("accessWorkbench.confirmSwitchAndSaveSnapshot", {
                defaultValue: "确认切换并保存快照",
              })}
            </Button>
            {!preview.protected && (
              <p className="text-xs">
                {t(
                  "accessWorkbench.enableConfigurationProtectionBeforeUsingSafeSwitching",
                  {
                    defaultValue: "请先开启配置保护，再使用工作台的安全切换。",
                  },
                )}
              </p>
            )}
          </div>
        )}
        <ErrorMessage error={error} />
      </section>
      <section className={panelClass}>
        <div className="flex justify-between">
          <h2 className="font-semibold">
            {t("accessWorkbench.recentSwitchSnapshots", {
              defaultValue: "最近切换快照",
            })}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void snapshots.refetch()}
          >
            {t("accessWorkbench.refresh", { defaultValue: "刷新" })}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("accessWorkbench.showsTheLatest30SnapshotsRestoreIsAllowedOnly", {
            defaultValue:
              "显示最近 30 条。仅当文件与切换完成时一致且目录未改变时允许恢复，避免覆盖后续手动编辑。快照含凭据，仅保存在本机。",
          })}
        </p>
        <ErrorMessage error={snapshots.error} />
        {snapshots.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t(
              "accessWorkbench.snapshotsAppearAfterYouEnableProtectionAndCompleteA",
              {
                defaultValue: "开启保护并完成一次直连切换后，将在此显示快照。",
              },
            )}
          </p>
        )}
        {snapshots.data?.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div>
              <p className="text-sm">
                {s.previousProvider
                  ? (providers.data?.[s.previousProvider]?.name ??
                    s.previousProvider)
                  : t("accessWorkbench.originalConfiguration", {
                      defaultValue: "原始配置",
                    })}{" "}
                →{" "}
                {s.nextProvider
                  ? (providers.data?.[s.nextProvider]?.name ?? s.nextProvider)
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(s.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || routed || !takeover.data || !s.canRestore}
              onClick={() => setRestoreId(s.id)}
            >
              {t("accessWorkbench.restore", { defaultValue: "恢复" })}
            </Button>
          </div>
        ))}
        {restoreId && (
          <div className="rounded-lg border border-primary/40 p-4 space-y-3">
            <p className="text-sm">
              {t(
                "accessWorkbench.restoreTheConfigurationAndProviderSelectionFromBeforeThis",
                {
                  defaultValue:
                    "恢复这次切换前的配置和供应商选择？现有文件若已变化，操作会拒绝执行。",
                },
              )}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await accessApi.restore(app, restoreId);
                    setRestoreId(null);
                    setPreview(null);
                    await refresh();
                    toast.success(
                      t(
                        "accessWorkbench.previousConfigurationRestoredRestartTheClientToReloadIt",
                        {
                          defaultValue:
                            "已恢复切换前配置，请重启客户端以重新加载。",
                        },
                      ),
                    );
                  })
                }
              >
                {t("accessWorkbench.confirmRestore", {
                  defaultValue: "确认恢复",
                })}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setRestoreId(null)}
              >
                {t("accessWorkbench.cancel", { defaultValue: "取消" })}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function RoutesPanel({ app, onAdd }: { app: AppId; onAdd: () => void }) {
  const { t } = useTranslation();

  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["access-route-status"],
    queryFn: proxyApi.getProxyStatus,
    refetchInterval: 5000,
  });
  const takeover = useQuery({
    queryKey: ["proxy", "takeover"],
    queryFn: proxyApi.getProxyTakeoverStatus,
    refetchInterval: 5000,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const active = status.data?.active_targets?.find((t) => t.app_type === app);
  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await proxyApi.setProxyTakeoverForApp(app, !takeover.data?.[app]);
      await Promise.all([
        takeover.refetch(),
        status.refetch(),
        queryClient.invalidateQueries({ queryKey: ["proxy"] }),
      ]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <section className={panelClass}>
        <h2 className="flex items-center gap-2 font-semibold">
          <Waypoints className="h-4 w-4" />
          {t("accessWorkbench.currentRoute", { defaultValue: "当前线路" })}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              t("accessWorkbench.proxyService", { defaultValue: "代理服务" }),
              status.data
                ? status.data.running
                  ? t("accessWorkbench.running", { defaultValue: "运行中" })
                  : t("accessWorkbench.stopped", { defaultValue: "已停止" })
                : t("accessWorkbench.loading", { defaultValue: "读取中" }),
            ],
            [
              t("accessWorkbench.routingForThisApp", {
                defaultValue: "当前应用接管",
              }),
              takeover.data
                ? takeover.data[app]
                  ? t("accessWorkbench.enabled", { defaultValue: "已开启" })
                  : t("accessWorkbench.disabled", { defaultValue: "未开启" })
                : t("accessWorkbench.loading", { defaultValue: "读取中" }),
            ],
            [
              t("accessWorkbench.activeTarget", { defaultValue: "实际目标" }),
              active?.provider_name ??
                t("accessWorkbench.noActiveRoute", {
                  defaultValue: "暂无活动线路",
                }),
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t(
            "accessWorkbench.requestsGoThroughLocalRoutingToYourSelectedProvider",
            {
              defaultValue:
                "开启后，请求经过本机路由，再发往你选择的供应商。未匹配模型规则时，自动故障转移使用下方队列；添加 HRouter 与其他渠道遵循相同规则。",
            },
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !takeover.data}
            onClick={() => void toggle()}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {takeover.data?.[app]
              ? t("accessWorkbench.disableRoutingAndRestoreConfiguration", {
                  defaultValue: "关闭此应用接管并恢复配置",
                })
              : t("accessWorkbench.enableLocalRoutingForThisApp", {
                  defaultValue: "开启此应用本地路由",
                })}
          </Button>
          <Button variant="outline" onClick={onAdd}>
            {t("accessWorkbench.addBackupProvider", {
              defaultValue: "添加备用供应商",
            })}
          </Button>
        </div>
        <ErrorMessage error={error || status.error || takeover.error} />
      </section>
      <section className={panelClass}>
        <h2 className="font-semibold">
          {t("accessWorkbench.automaticFailoverQueue", {
            defaultValue: "自动故障转移队列",
          })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "accessWorkbench.tryAlternativesInQueueOrderUsingTheProviderOrder",
            {
              defaultValue:
                "按队列顺序尝试备选渠道。顺序沿用配置中心的供应商排序。仅配置队列而未开启接管时，不会转发流量。",
            },
          )}
        </p>
        <FailoverQueueManager appType={app} disabled={busy} />
      </section>
      <p className="text-xs text-muted-foreground">
        {t("accessWorkbench.seeEachRequestSProviderActualModelStatusAnd", {
          defaultValue:
            "逐条请求的供应商、实际模型、状态与费用，可在“费用与账单 → 本地估算”中查看。全局切换次数：",
        })}
        {status.data?.failover_count ?? "—"}。
      </p>
    </div>
  );
}

function CostsPanel({
  onHRouterUsage,
  onHRouterAccount,
}: Pick<Props, "onHRouterUsage" | "onHRouterAccount">) {
  const { t } = useTranslation();

  const session = useHRouterSession();
  const profile = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "profile"],
    queryFn: hrouterAccountApi.profile,
    enabled: !!session,
    refetchInterval: 60000,
  });
  const stats = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "usage-stats", "all"],
    queryFn: () => hrouterAccountApi.usageStats(),
    enabled: !!session,
  });
  const [threshold, setThreshold] = useState(() => {
    const n = Number(localStorage.getItem("hrouter-balance-alert") ?? "10");
    return Number.isFinite(n) && n >= 0 ? n : 10;
  });
  const balance = profile.data?.balance;
  const low = balance !== undefined && Number(balance) < threshold;
  useEffect(() => {
    localStorage.setItem("hrouter-balance-alert", String(threshold));
  }, [threshold]);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <section className={panelClass}>
          <h2 className="font-semibold">
            {t("accessWorkbench.localEstimate", { defaultValue: "本地估算" })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "accessWorkbench.calculatedFromLocalRequestsSessionLogsAndConfiguredPrices",
              {
                defaultValue:
                  "根据本机请求与会话记录、配置的模型价格计算。受数据覆盖、缓存、重试和价格表影响，不作为服务商扣费凭证。",
              },
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("accessWorkbench.filterByAppProviderModelOrDateAndInspect", {
              defaultValue:
                "下方仪表盘可筛选应用、供应商、模型和时间，并查看逐条请求。",
            })}
          </p>
        </section>
        <section className={panelClass}>
          <h2 className="font-semibold">
            {t("accessWorkbench.hrouterServerBilling", {
              defaultValue: "HRouter 服务端账单",
            })}
          </h2>
          {session ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("accessWorkbench.accountBalanceCny", {
                      defaultValue: "账户余额 · CNY",
                    })}
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {balance !== undefined
                      ? `¥${Number(balance).toFixed(2)}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("accessWorkbench.totalActualAccountSpendCny", {
                      defaultValue: "账号累计实际消费 · CNY",
                    })}
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {stats.data
                      ? `¥${Number(stats.data.total_actual_cost).toFixed(4)}`
                      : "—"}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                {t("accessWorkbench.alertBelow", {
                  defaultValue: "余额低于 ¥",
                })}
                <Input
                  aria-label={t("accessWorkbench.balanceAlertThreshold", {
                    defaultValue: "余额提醒阈值",
                  })}
                  className="w-24"
                  type="number"
                  min="0"
                  value={threshold}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 0) setThreshold(n);
                  }}
                />
                {t("accessWorkbench.remaining", { defaultValue: "时在此提醒" })}
              </label>
              {low && (
                <p
                  role="status"
                  className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
                >
                  {t(
                    "accessWorkbench.balanceIsBelowYourThresholdMeteredCallsMayBe",
                    {
                      defaultValue:
                        "余额低于设定阈值，按量调用可能受到影响。套餐额度请以服务端记录为准。",
                    },
                  )}
                </p>
              )}
              <ErrorMessage error={profile.error || stats.error} />
              <Button variant="outline" onClick={onHRouterUsage}>
                {t("accessWorkbench.viewIndividualServerCharges", {
                  defaultValue: "查看服务端逐笔消费",
                })}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t("accessWorkbench.signInToViewActualChargesBalanceAndPlans", {
                  defaultValue:
                    "登录后查看服务端实际扣费、余额和套餐。不登录也可使用本地统计。",
                })}
              </p>
              <Button variant="outline" onClick={onHRouterAccount}>
                {t("accessWorkbench.aboutSignInToHrouter", {
                  defaultValue: "了解 / 登录 HRouter",
                })}
              </Button>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {t(
              "accessWorkbench.serverRecordsMayIncludeOtherDevicesLocalEstimatesAnd",
              {
                defaultValue:
                  "服务端记录可能涵盖其他设备。本地估算与账号累计消费范围、币种可能不同，不直接相减。",
              },
            )}
          </p>
        </section>
      </div>
      {session && (
        <BillingReconciliation key={session.user.id} userId={session.user.id} />
      )}
      <section className="rounded-xl border border-border p-3">
        <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          {t("accessWorkbench.localRequestsAndEstimatedCosts", {
            defaultValue: "本机请求与估算明细",
          })}
        </div>
        <UsageDashboard />
      </section>
    </div>
  );
}
