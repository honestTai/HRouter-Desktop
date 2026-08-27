import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  FileCode2,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  Layers3,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ModelInputWithFetch } from "./shared/ModelInputWithFetch";
import type { AppId } from "@/lib/api";
import {
  fetchModelsForConfig,
  showFetchModelsError,
  type FetchedModel,
} from "@/lib/api/model-fetch";
import { useProvidersQuery } from "@/lib/query/queries";
import {
  buildHRouterProviderMeta,
  buildHRouterSettingsConfig,
  deriveHRouterModelMapping,
  extractHRouterProviderState,
  HROUTER_CODEX_1M_AUTO_COMPACT_TOKEN_LIMIT,
  HROUTER_CODEX_1M_CONTEXT_WINDOW,
  HROUTER_CODEX_DEFAULT_AUTO_COMPACT_TOKEN_LIMIT,
  HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW,
  HROUTER_APP_NAMES,
  HROUTER_ICON_COLOR,
  HROUTER_MODELS_URL,
  HROUTER_ORIGIN,
  type HRouterModelMapping,
} from "@/lib/hrouter";
import type { Provider } from "@/types";
import type { ProviderFormValues } from "./ProviderForm";

interface HRouterProviderFormProps {
  appId: AppId;
  onSubmit: (values: ProviderFormValues) => Promise<void> | void;
  onCancel: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  showButtons?: boolean;
  initialProvider?: Provider;
}

const emptyMapping: HRouterModelMapping = {
  primary: "",
  haiku: "",
  sonnet: "",
  opus: "",
};

const parsePositiveInteger = (value: string): number | undefined => {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const formatTokenValue = (value: string): string =>
  parsePositiveInteger(value)?.toLocaleString("zh-CN") ?? "未设置";

type CodexContextMode = "official-272k" | "official-1m" | "custom";

const getCodexContextMode = (
  contextWindow: number,
  autoCompactTokenLimit: number,
): CodexContextMode => {
  if (
    contextWindow === HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW &&
    autoCompactTokenLimit === HROUTER_CODEX_DEFAULT_AUTO_COMPACT_TOKEN_LIMIT
  ) {
    return "official-272k";
  }
  if (
    contextWindow === HROUTER_CODEX_1M_CONTEXT_WINDOW &&
    autoCompactTokenLimit === HROUTER_CODEX_1M_AUTO_COMPACT_TOKEN_LIMIT
  ) {
    return "official-1m";
  }
  return "custom";
};

const uniqueProviderKey = (): string => {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);
  return `hrouter-${suffix}`;
};

export function HRouterProviderForm({
  appId,
  onSubmit,
  onCancel,
  onSubmittingChange,
  showButtons = true,
  initialProvider,
}: HRouterProviderFormProps) {
  const { t } = useTranslation();
  const { data } = useProvidersQuery(appId);
  const hrouterCount = useMemo(
    () =>
      Object.values(data?.providers ?? {}).filter(
        (provider) => provider.meta?.providerType === "hrouter",
      ).length,
    [data?.providers],
  );
  const defaultName =
    initialProvider?.name ??
    (hrouterCount === 0 ? "HRouter" : `HRouter ${hrouterCount + 1}`);
  const initialState = useMemo(
    () =>
      initialProvider
        ? extractHRouterProviderState(appId, initialProvider)
        : {
            apiKey: "",
            mapping: emptyMapping,
            codexContextConfig: {
              contextWindow: HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW,
              autoCompactTokenLimit:
                HROUTER_CODEX_DEFAULT_AUTO_COMPACT_TOKEN_LIMIT,
            },
          },
    [appId, initialProvider],
  );

  const [name, setName] = useState(initialProvider?.name ?? "");
  const [apiKey, setApiKey] = useState(initialState.apiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [mapping, setMapping] = useState<HRouterModelMapping>(
    initialState.mapping,
  );
  const [codexContextWindow, setCodexContextWindow] = useState(
    String(initialState.codexContextConfig.contextWindow),
  );
  const [codexAutoCompactTokenLimit, setCodexAutoCompactTokenLimit] = useState(
    String(initialState.codexContextConfig.autoCompactTokenLimit),
  );
  const [codexContextMode, setCodexContextMode] = useState<CodexContextMode>(
    getCodexContextMode(
      initialState.codexContextConfig.contextWindow,
      initialState.codexContextConfig.autoCompactTokenLimit,
    ),
  );
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providerKey] = useState(initialProvider?.id ?? uniqueProviderKey);

  const isClaudeApp = appId === "claude" || appId === "claude-desktop";

  const selectCodexContextMode = (mode: CodexContextMode) => {
    setCodexContextMode(mode);
    if (mode === "official-272k") {
      setCodexContextWindow(String(HROUTER_CODEX_DEFAULT_CONTEXT_WINDOW));
      setCodexAutoCompactTokenLimit(
        String(HROUTER_CODEX_DEFAULT_AUTO_COMPACT_TOKEN_LIMIT),
      );
    } else if (mode === "official-1m") {
      setCodexContextWindow(String(HROUTER_CODEX_1M_CONTEXT_WINDOW));
      setCodexAutoCompactTokenLimit(
        String(HROUTER_CODEX_1M_AUTO_COMPACT_TOKEN_LIMIT),
      );
    }
  };

  const codexConfigPreview = `model_context_window = ${codexContextWindow || "<未设置>"}\nmodel_auto_compact_token_limit = ${codexAutoCompactTokenLimit || "<未设置>"}`;

  useEffect(() => {
    if (!initialProvider || !initialState.apiKey) return;
    let cancelled = false;

    void fetchModelsForConfig(
      HROUTER_ORIGIN,
      initialState.apiKey,
      false,
      HROUTER_MODELS_URL,
    )
      .then((models) => {
        if (cancelled || models.length === 0) return;
        const recommended = deriveHRouterModelMapping(appId, models);
        setFetchedModels(models);
        setMapping((current) => ({
          primary: current.primary || recommended.primary,
          haiku: current.haiku || recommended.haiku,
          sonnet: current.sonnet || recommended.sonnet,
          opus: current.opus || recommended.opus,
        }));
      })
      .catch(() => {
        // 编辑时保留本地已保存的 Key 与映射；用户可手动点击“重新获取”。
      });

    return () => {
      cancelled = true;
    };
  }, [appId, initialProvider, initialState.apiKey]);

  const importModels = useCallback(async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error("请输入 HRouter Key");
      return null;
    }

    setIsFetching(true);
    try {
      const models = await fetchModelsForConfig(
        HROUTER_ORIGIN,
        key,
        false,
        HROUTER_MODELS_URL,
      );
      if (models.length === 0) {
        toast.error("这个 Key 没有返回可用模型，请检查分组或权限");
        return null;
      }

      const nextMapping = deriveHRouterModelMapping(appId, models);
      setFetchedModels(models);
      setMapping(nextMapping);
      toast.success(`已导入 ${models.length} 个 HRouter 模型`);
      return { models, mapping: nextMapping };
    } catch (error) {
      showFetchModelsError(error, t, {
        hasApiKey: Boolean(key),
        hasBaseUrl: true,
      });
      return null;
    } finally {
      setIsFetching(false);
    }
  }, [apiKey, appId, t]);

  const submit = useCallback(async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error("请输入 HRouter Key");
      return;
    }

    setIsSubmitting(true);
    onSubmittingChange?.(true);
    try {
      let models = fetchedModels;
      let effectiveMapping = mapping;
      if (models.length === 0) {
        const imported = await importModels();
        if (!imported) return;
        models = imported.models;
        effectiveMapping = imported.mapping;
      }
      if (!effectiveMapping.primary) {
        toast.error(`当前 Key 没有可映射到 ${HROUTER_APP_NAMES[appId]} 的模型`);
        return;
      }

      const contextWindow = parsePositiveInteger(codexContextWindow);
      const autoCompactTokenLimit = parsePositiveInteger(
        codexAutoCompactTokenLimit,
      );
      if (appId === "codex" && !contextWindow) {
        toast.error("请输入有效的上下文窗口");
        return;
      }
      if (appId === "codex" && !autoCompactTokenLimit) {
        toast.error("请输入有效的自动压缩阈值");
        return;
      }
      if (
        appId === "codex" &&
        contextWindow &&
        autoCompactTokenLimit &&
        autoCompactTokenLimit >= contextWindow
      ) {
        toast.error("自动压缩阈值必须小于上下文窗口");
        return;
      }

      const settingsConfig = buildHRouterSettingsConfig(
        appId,
        key,
        effectiveMapping,
        models,
        appId === "codex" && contextWindow && autoCompactTokenLimit
          ? { contextWindow, autoCompactTokenLimit }
          : undefined,
      );
      const values: ProviderFormValues = {
        name: name.trim() || defaultName,
        websiteUrl: HROUTER_ORIGIN,
        notes: `${HROUTER_APP_NAMES[appId]} · HRouter Key 自动配置`,
        settingsConfig: JSON.stringify(settingsConfig, null, 2),
        icon: "hrouter",
        iconColor: HROUTER_ICON_COLOR,
        presetCategory: "aggregator",
        meta: buildHRouterProviderMeta(appId, effectiveMapping, key),
        ...(appId === "opencode" || appId === "openclaw" || appId === "hermes"
          ? { providerKey }
          : {}),
        ...(appId === "openclaw"
          ? {
              suggestedDefaults: {
                model: {
                  primary: `${providerKey}/${effectiveMapping.primary}`,
                },
                modelCatalog: Object.fromEntries(
                  models.map((model) => [
                    `${providerKey}/${model.id}`,
                    { alias: model.id },
                  ]),
                ),
              },
            }
          : {}),
      };

      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
      onSubmittingChange?.(false);
    }
  }, [
    apiKey,
    appId,
    codexAutoCompactTokenLimit,
    codexContextWindow,
    defaultName,
    fetchedModels,
    importModels,
    mapping,
    name,
    onSubmit,
    onSubmittingChange,
    providerKey,
  ]);

  return (
    <form
      id="provider-form"
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-start gap-3">
          <ProviderIcon
            icon="hrouter"
            name="HRouter"
            color={HROUTER_ICON_COLOR}
            size={42}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">HRouter</h3>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {HROUTER_APP_NAMES[appId]}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              输入 Key 即可导入可用模型并生成当前 Agent 的配置。
            </p>
            <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
              {HROUTER_ORIGIN}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hrouter-api-key">HRouter Key</Label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="hrouter-api-key"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setFetchedModels([]);
                setMapping(emptyMapping);
              }}
              placeholder="sk-..."
              autoComplete="off"
              className="pl-9 pr-10"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowApiKey((visible) => !visible)}
              aria-label={showApiKey ? "隐藏 Key" : "显示 Key"}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void importModels()}
            disabled={!apiKey.trim() || isFetching}
            className="shrink-0"
          >
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : fetchedModels.length > 0 ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            {fetchedModels.length > 0 ? "已识别" : "识别 Key"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Key 只保存在本机配置中，用于读取该 Key 实际可用的模型。
        </p>
      </div>

      {fetchedModels.length > 0 && (
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                已导入 {fetchedModels.length} 个模型
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                已为 {HROUTER_APP_NAMES[appId]} 预填推荐映射，下面可自行修改。
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          </div>
        </div>
      )}

      {fetchedModels.length > 0 && (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Layers3 className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <h4 className="text-sm font-semibold">模型绑定</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                HRouter 只预填推荐值；保存后仍可再次进入编辑并调整。
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hrouter-primary-model">默认模型</Label>
            <ModelInputWithFetch
              id="hrouter-primary-model"
              value={mapping.primary}
              onChange={(primary) =>
                setMapping((current) => ({ ...current, primary }))
              }
              fetchedModels={fetchedModels}
              isLoading={false}
            />
          </div>

          {isClaudeApp && (
            <div className="grid gap-3 sm:grid-cols-3">
              {(["haiku", "sonnet", "opus"] as const).map((role) => (
                <div key={role} className="space-y-2">
                  <Label
                    htmlFor={`hrouter-${role}-model`}
                    className="capitalize"
                  >
                    {role}
                  </Label>
                  <ModelInputWithFetch
                    id={`hrouter-${role}-model`}
                    value={mapping[role]}
                    onChange={(value) =>
                      setMapping((current) => ({
                        ...current,
                        [role]: value,
                      }))
                    }
                    fetchedModels={fetchedModels}
                    isLoading={false}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {appId === "codex" && (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Gauge className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <h4 className="text-sm font-semibold">Codex 上下文</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                当前窗口 {formatTokenValue(codexContextWindow)} token，达到{" "}
                {formatTokenValue(codexAutoCompactTokenLimit)} token
                时自动压缩。
              </p>
            </div>
          </div>

          <div
            className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
            role="radiogroup"
            aria-label="上下文配置"
          >
            {(
              [
                ["official-272k", "官方 272K"],
                ["official-1m", "官方 1M"],
                ["custom", "自定义"],
              ] as const
            ).map(([mode, label]) => {
              const active = codexContextMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`min-h-9 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => selectCodexContextMode(mode)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {codexContextMode === "custom" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hrouter-codex-context-window">上下文窗口</Label>
                <Input
                  id="hrouter-codex-context-window"
                  type="number"
                  min={1}
                  step={1000}
                  inputMode="numeric"
                  value={codexContextWindow}
                  onChange={(event) =>
                    setCodexContextWindow(
                      event.target.value.replace(/[^\d]/g, ""),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hrouter-codex-auto-compact-limit">
                  自动压缩阈值
                </Label>
                <Input
                  id="hrouter-codex-auto-compact-limit"
                  type="number"
                  min={1}
                  step={1000}
                  inputMode="numeric"
                  value={codexAutoCompactTokenLimit}
                  onChange={(event) =>
                    setCodexAutoCompactTokenLimit(
                      event.target.value.replace(/[^\d]/g, ""),
                    )
                  }
                />
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border bg-muted/25">
            <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
              <FileCode2 className="h-3.5 w-3.5" />
              <span>config.toml</span>
            </div>
            <pre
              aria-label="config.toml 配置预览"
              className="overflow-x-auto px-3 py-3 text-xs leading-5 text-foreground"
            >
              <code>{codexConfigPreview}</code>
            </pre>
          </div>
        </section>
      )}

      {fetchedModels.length > 0 && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div>
            <h4 className="text-sm font-semibold">
              当前 Key 的完整模型列表（{fetchedModels.length}）
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              包含 HRouter 实际返回的 Claude、Codex/GPT 与 Gemini 模型。
            </p>
          </div>
          <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-lg bg-muted/30 p-3">
            {fetchedModels.map((model) => (
              <span
                key={model.id}
                className="rounded-md border bg-background px-2 py-1 font-mono text-xs"
                title={model.ownedBy || model.id}
              >
                {model.id}
              </span>
            ))}
          </div>
        </section>
      )}

      <details className="group rounded-xl border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
          配置名称（可选）
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            用于区分多个 HRouter Key
          </span>
        </summary>
        <div className="space-y-4 border-t px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="hrouter-config-name">配置名称</Label>
            <Input
              id="hrouter-config-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={defaultName}
            />
          </div>
        </div>
      </details>

      {showButtons && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!apiKey.trim() || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialProvider ? "保存 HRouter" : "添加 HRouter"}
          </Button>
        </div>
      )}
    </form>
  );
}
