import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Check,
  Copy,
  Download,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
import { HRouterPageShell } from "@/components/hrouter/HRouterPageShell";
import { HRouterKeyFormDialog } from "@/components/hrouter/HRouterKeyFormDialog";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CodexCatalogModel } from "@/types";
import { ModelInputWithFetch } from "@/components/providers/forms/shared/ModelInputWithFetch";
import { HRouterCodexModelMapping } from "@/components/providers/forms/shared/HRouterCodexModelMapping";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  hrouterAccountApi,
  type HRouterApiKey,
  type HRouterKeyCreateInput,
  type HRouterKeyUpdateInput,
} from "@/lib/api/hrouterPlatform";
import { providersApi, type AppId } from "@/lib/api";
import { proxyApi } from "@/lib/api/proxy";
import {
  fetchModelsForConfig,
  showFetchModelsError,
  type FetchedModel,
} from "@/lib/api/model-fetch";
import {
  buildHRouterProviderMeta,
  buildHRouterSettingsConfig,
  deriveHRouterModelMapping,
  mergeHRouterModelMapping,
  buildHRouterCodexCatalog,
  HROUTER_APP_NAMES,
  HROUTER_ICON_COLOR,
  HROUTER_MODELS_URL,
  HROUTER_ORIGIN,
  type HRouterModelMapping,
} from "@/lib/hrouter";
import { useAddProviderMutation } from "@/lib/query";
import { extractErrorMessage } from "@/utils/errorUtils";

const importApps: AppId[] = [
  "codex",
  "claude",
  "claude-desktop",
  "gemini",
  "grokbuild",
  "opencode",
  "openclaw",
  "hermes",
];

const emptyMapping: HRouterModelMapping = {
  primary: "",
  haiku: "",
  sonnet: "",
  opus: "",
};

function maskedKey(value: string) {
  if (value.length < 14) return value;
  return `${value.slice(0, 8)}••••••••${value.slice(-4)}`;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    await invoke("copy_text_to_clipboard", { text: value });
  }
}

export function HRouterApiKeysPage() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<HRouterApiKey | null>(null);
  const [editTarget, setEditTarget] = useState<HRouterApiKey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HRouterApiKey | null>(null);
  const [importTarget, setImportTarget] = useState<HRouterApiKey | null>(null);
  const [importApp, setImportApp] = useState<AppId>("codex");
  const [importing, setImporting] = useState(false);
  const [loadingImportModels, setLoadingImportModels] = useState(false);
  const [importCatalog, setImportCatalog] = useState<
    CodexCatalogModel[] | undefined
  >();
  const [importModels, setImportModels] = useState<FetchedModel[]>([]);
  const [importMapping, setImportMapping] =
    useState<HRouterModelMapping>(emptyMapping);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const keys = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "keys"],
    queryFn: () => hrouterAccountApi.keys(),
    enabled: Boolean(session),
  });
  const groups = useQuery({
    queryKey: ["hrouter-account", "groups"],
    queryFn: hrouterAccountApi.groups,
    enabled: Boolean(session),
  });
  const addProvider = useAddProviderMutation(importApp);
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["hrouter-account", session?.user.id, "keys"],
    });

  const createKey = useMutation({
    mutationFn: (input: HRouterKeyCreateInput) =>
      hrouterAccountApi.createKey(input),
    onSuccess: (key) => {
      setCreateOpen(false);
      setCreatedKey(key);
      void invalidate();
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const updateKey = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: number;
      updates: HRouterKeyUpdateInput;
    }) => hrouterAccountApi.updateKey(id, updates),
    onSuccess: () => {
      setEditTarget(null);
      void invalidate();
      toast.success(
        t("hrouterPlatform.keyUpdated", { defaultValue: "密钥已更新" }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  useEffect(() => {
    if (!importTarget) {
      setImportModels([]);
      setImportMapping(emptyMapping);
      return;
    }
    let cancelled = false;
    setImportModels([]);
    setImportMapping(emptyMapping);
    setImportCatalog(undefined);
    setLoadingImportModels(true);
    void fetchModelsForConfig(
      HROUTER_ORIGIN,
      importTarget.key,
      false,
      HROUTER_MODELS_URL,
    )
      .then((models) => {
        if (cancelled) return;
        setImportModels(models);
        const recommended = deriveHRouterModelMapping(importApp, models);
        setImportMapping((current) =>
          mergeHRouterModelMapping(current, recommended),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          showFetchModelsError(error, t, {
            hasApiKey: true,
            hasBaseUrl: true,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingImportModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [importApp, importTarget, t]);
  const deleteKey = useMutation({
    mutationFn: (id: number) => hrouterAccountApi.deleteKey(id),
    onSuccess: () => {
      setDeleteTarget(null);
      void invalidate();
      toast.success(t("hrouterPlatform.keyDeleted"));
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const handleCopy = async (key: HRouterApiKey) => {
    await copyText(key.key);
    setCopiedId(key.id);
    window.setTimeout(
      () => setCopiedId((id) => (id === key.id ? null : id)),
      1500,
    );
  };

  const handleImport = async () => {
    if (!importTarget) return;
    setImporting(true);
    try {
      const models =
        importModels.length > 0 || importMapping.primary.trim()
          ? importModels
          : await fetchModelsForConfig(
              HROUTER_ORIGIN,
              importTarget.key,
              false,
              HROUTER_MODELS_URL,
            );
      if (models.length === 0 && !importMapping.primary.trim()) {
        toast.error(
          t("hrouterPlatform.noModelsForKey", {
            defaultValue: "这个密钥没有返回可用模型，请检查分组或权限",
          }),
        );
        return;
      }
      const mapping = importMapping.primary
        ? importMapping
        : deriveHRouterModelMapping(importApp, models);
      if (!mapping.primary) {
        toast.error(
          t("hrouterPlatform.noCompatibleModel", {
            defaultValue: "当前密钥没有可用于 {{agent}} 的模型",
            agent: HROUTER_APP_NAMES[importApp],
          }),
        );
        return;
      }
      if (
        importApp === "codex" &&
        importCatalog &&
        (importCatalog.some((row) => !row.model.trim()) ||
          new Set(importCatalog.map((row) => row.model.trim())).size !==
            importCatalog.length)
      ) {
        toast.error("请填写不重复的实际模型 ID，或删除空白行");
        return;
      }
      const providerKey = `hrouter-${importTarget.id}`;
      const provider = await addProvider.mutateAsync({
        name: `HRouter · ${importTarget.name}`,
        notes: `${HROUTER_APP_NAMES[importApp]} · HRouter Key 自动配置`,
        websiteUrl: HROUTER_ORIGIN,
        settingsConfig: buildHRouterSettingsConfig(
          importApp,
          importTarget.key,
          { ...mapping, primary: mapping.primary.trim() },
          models,
          undefined,
          importApp === "codex" ? importCatalog : undefined,
        ),
        icon: "hrouter",
        iconColor: HROUTER_ICON_COLOR,
        category: "aggregator",
        meta: buildHRouterProviderMeta(importApp, mapping, importTarget.key),
        providerKey,
        addToLive:
          importApp === "opencode" ||
          importApp === "openclaw" ||
          importApp === "hermes",
      });
      if (
        importApp !== "opencode" &&
        importApp !== "openclaw" &&
        importApp !== "hermes"
      ) {
        if (importApp === "claude-desktop") {
          await proxyApi.startProxyServer();
        }
        await providersApi.switch(provider.id, importApp);
      }
      setImportTarget(null);
      toast.success(
        t("hrouterPlatform.importedAndActivated", {
          defaultValue: "已导入并应用到 {{agent}}",
          agent: HROUTER_APP_NAMES[importApp],
        }),
      );
    } catch (error) {
      showFetchModelsError(error, t, {
        hasApiKey: Boolean(importTarget.key),
        hasBaseUrl: true,
      });
    } finally {
      setImporting(false);
    }
  };
  const showClaudeMapping =
    importApp === "claude" || importApp === "claude-desktop";

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={() => void Promise.all([keys.refetch(), groups.refetch()])}
        refreshing={keys.isFetching || groups.isFetching}
      >
        <div className="mb-4 flex justify-end">
          <Button
            size="sm"
            data-tour="create-key"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("hrouterPlatform.createKey")}
          </Button>
        </div>
        {keys.isLoading || groups.isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("hrouterPlatform.loadingKeys")}
          </div>
        ) : keys.error || groups.error ? (
          <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            {extractErrorMessage(keys.error || groups.error)}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border-default bg-background">
            <div className="max-h-[calc(100vh-250px)] min-h-[360px] overflow-auto overscroll-contain [scrollbar-gutter:stable]">
              <Table className="min-w-[980px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-10">
                      {t("hrouterPlatform.name")}
                    </TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.key")}
                    </TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.group", { defaultValue: "分组" })}
                    </TableHead>
                    <TableHead className="h-10 text-right">
                      {t("hrouterPlatform.concurrency", {
                        defaultValue: "当前并发",
                      })}
                    </TableHead>
                    <TableHead className="h-10 text-right">
                      {t("hrouterPlatform.usedQuota")}
                    </TableHead>
                    <TableHead className="h-10">
                      {t("hrouterPlatform.status")}
                    </TableHead>
                    <TableHead className="h-10 text-right">
                      {t("hrouterPlatform.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(keys.data?.items ?? []).map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="py-3 font-medium">
                        {key.name}
                      </TableCell>
                      <TableCell className="py-3">
                        <code className="text-xs text-muted-foreground">
                          {maskedKey(key.key)}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-56 truncate py-3 text-xs">
                        {key.group?.name ||
                          groups.data?.find(
                            (group) => group.id === key.group_id,
                          )?.name ||
                          "-"}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums">
                        {key.current_concurrency ?? 0}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums">
                        <span>¥{Number(key.quota_used || 0).toFixed(2)}</span>
                        {key.quota > 0 && (
                          <span className="block text-[10px] text-muted-foreground">
                            / ¥{Number(key.quota).toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className={`inline-flex rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${key.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                        >
                          {key.status === "active"
                            ? t("hrouterPlatform.active")
                            : t("hrouterPlatform.inactive")}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary"
                            title={t("hrouterPlatform.importToAgent", {
                              defaultValue: "导入到 Agent",
                            })}
                            disabled={key.status !== "active"}
                            onClick={() => setImportTarget(key)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t("hrouterPlatform.editKey", {
                              defaultValue: "编辑密钥",
                            })}
                            onClick={() => setEditTarget(key)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t("hrouterPlatform.copyKey")}
                            onClick={() => void handleCopy(key)}
                          >
                            {copiedId === key.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={
                              key.status === "active"
                                ? t("hrouterPlatform.disable")
                                : t("hrouterPlatform.enable")
                            }
                            onClick={() =>
                              updateKey.mutate({
                                id: key.id,
                                updates: {
                                  status:
                                    key.status === "active"
                                      ? "inactive"
                                      : "active",
                                },
                              })
                            }
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:text-red-500"
                            title={t("common.delete")}
                            onClick={() => setDeleteTarget(key)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(keys.data?.items ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-40 text-center text-muted-foreground"
                      >
                        {t("hrouterPlatform.noKeys")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <HRouterKeyFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          groups={groups.data ?? []}
          pending={createKey.isPending}
          onSubmit={(values) =>
            createKey.mutate(values as HRouterKeyCreateInput)
          }
        />
        <HRouterKeyFormDialog
          open={Boolean(editTarget)}
          onOpenChange={(open) => !open && setEditTarget(null)}
          groups={groups.data ?? []}
          apiKey={editTarget}
          pending={updateKey.isPending}
          onSubmit={(updates) =>
            editTarget &&
            updateKey.mutate({
              id: editTarget.id,
              updates: updates as HRouterKeyUpdateInput,
            })
          }
        />

        <Dialog
          open={Boolean(createdKey)}
          onOpenChange={(open) => !open && setCreatedKey(null)}
        >
          <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>{t("hrouterPlatform.keyCreated")}</DialogTitle>
              <DialogDescription>
                {t("hrouterPlatform.saveCreatedKey")}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 [scrollbar-gutter:stable]">
              <code className="block break-all rounded-md border border-border-default bg-muted/40 p-3 text-xs">
                {createdKey?.key}
              </code>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreatedKey(null)}>
                {t("common.close")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!createdKey) return;
                  setImportTarget(createdKey);
                  setCreatedKey(null);
                }}
              >
                <Download className="h-4 w-4" />
                {t("hrouterPlatform.importToAgent", {
                  defaultValue: "导入到 Agent",
                })}
              </Button>
              <Button onClick={() => createdKey && void handleCopy(createdKey)}>
                <Copy className="h-4 w-4" />
                {t("hrouterPlatform.copyKey")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(importTarget)}
          onOpenChange={(open) => !open && setImportTarget(null)}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {t("hrouterPlatform.importKeyTitle", {
                  defaultValue: "一键导入 HRouter",
                })}
              </DialogTitle>
              <DialogDescription>
                {t("hrouterPlatform.importKeyDescription", {
                  defaultValue:
                    "选择 Agent 后将自动获取模型、生成默认配置并立即应用。",
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto px-6 py-5">
              <Label>
                {t("hrouterPlatform.agent", { defaultValue: "Agent" })}
              </Label>
              <Select
                value={importApp}
                onValueChange={(value) => setImportApp(value as AppId)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {importApps.map((app) => (
                    <SelectItem key={app} value={app}>
                      {HROUTER_APP_NAMES[app]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-md border border-border-default p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Label>
                    {t("hrouterPlatform.modelMapping", {
                      defaultValue: "模型映射",
                    })}
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {loadingImportModels
                      ? "正在读取模型..."
                      : `已读取 ${importModels.length} 个模型`}
                  </span>
                </div>
                <div
                  className={`grid gap-3 ${showClaudeMapping ? "sm:grid-cols-2" : ""}`}
                >
                  {[
                    ["primary", "默认模型"],
                    ...(showClaudeMapping
                      ? [
                          ["haiku", "Haiku"],
                          ["sonnet", "Sonnet"],
                          ["opus", "Opus"],
                        ]
                      : []),
                  ].map(([field, label]) => (
                    <div key={field}>
                      <Label
                        htmlFor={`hrouter-import-${field}`}
                        className="text-xs"
                      >
                        {label}
                      </Label>
                      <ModelInputWithFetch
                        id={`hrouter-import-${field}`}
                        value={
                          importMapping[field as keyof HRouterModelMapping]
                        }
                        onChange={(value) =>
                          setImportMapping((current) => ({
                            ...current,
                            [field]: value,
                          }))
                        }
                        fetchedModels={importModels}
                        isLoading={loadingImportModels}
                      />
                    </div>
                  ))}
                </div>
                {importApp === "codex" && (
                  <HRouterCodexModelMapping
                    rows={
                      importCatalog ??
                      buildHRouterCodexCatalog(
                        importMapping.primary,
                        importModels,
                      )
                    }
                    models={importModels}
                    onChange={setImportCatalog}
                  />
                )}
                {importApp === "claude-desktop" && (
                  <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                    HRouter 的 Claude Desktop 配置会启用本地代理映射，支持将
                    Sonnet、Opus、Haiku 档位映射到当前密钥可用的实际模型。
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-md border border-border-default bg-muted/30 px-3 py-3">
                <Bot className="h-5 w-5 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {importTarget?.name}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {importTarget ? maskedKey(importTarget.key) : ""}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={
                  importing ||
                  loadingImportModels ||
                  !importMapping.primary.trim()
                }
                onClick={() => void handleImport()}
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t("hrouterPlatform.confirmImport", {
                  defaultValue: "确认导入",
                })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("hrouterPlatform.deleteKey")}</DialogTitle>
              <DialogDescription>
                {t("hrouterPlatform.deleteKeyConfirm", {
                  name: deleteTarget?.name,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteKey.isPending}
                onClick={() =>
                  deleteTarget && deleteKey.mutate(deleteTarget.id)
                }
              >
                {t("common.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
