import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
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
  getHRouterModelsForApp,
  HROUTER_APP_NAMES,
  HROUTER_ICON_COLOR,
  HROUTER_MODELS_URL,
  HROUTER_ORIGIN,
  type HRouterModelMapping,
} from "@/lib/hrouter";
import type { ProviderFormValues } from "./ProviderForm";

interface HRouterProviderFormProps {
  appId: AppId;
  onSubmit: (values: ProviderFormValues) => Promise<void> | void;
  onCancel: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  showButtons?: boolean;
}

const emptyMapping: HRouterModelMapping = {
  primary: "",
  haiku: "",
  sonnet: "",
  opus: "",
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
    hrouterCount === 0 ? "HRouter" : `HRouter ${hrouterCount + 1}`;

  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [mapping, setMapping] = useState<HRouterModelMapping>(emptyMapping);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providerKey] = useState(uniqueProviderKey);

  const appModels = useMemo(
    () => getHRouterModelsForApp(appId, fetchedModels),
    [appId, fetchedModels],
  );
  const isClaudeApp = appId === "claude" || appId === "claude-desktop";

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

      const settingsConfig = buildHRouterSettingsConfig(
        appId,
        key,
        effectiveMapping,
        models,
      );
      const values: ProviderFormValues = {
        name: name.trim() || defaultName,
        websiteUrl: HROUTER_ORIGIN,
        notes: `${HROUTER_APP_NAMES[appId]} · HRouter Key 自动配置`,
        settingsConfig: JSON.stringify(settingsConfig, null, 2),
        icon: "hrouter",
        iconColor: HROUTER_ICON_COLOR,
        presetCategory: "aggregator",
        meta: buildHRouterProviderMeta(appId, effectiveMapping),
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
                已为 {HROUTER_APP_NAMES[appId]} 自动映射：{mapping.primary}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          </div>
        </div>
      )}

      <details className="group rounded-xl border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
          高级设置（可选）
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            配置名称与模型映射
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

          {fetchedModels.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="hrouter-primary-model">默认模型</Label>
                <ModelInputWithFetch
                  id="hrouter-primary-model"
                  value={mapping.primary}
                  onChange={(primary) =>
                    setMapping((current) => ({ ...current, primary }))
                  }
                  fetchedModels={appModels}
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
                        fetchedModels={appModels}
                        isLoading={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </details>

      {showButtons && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!apiKey.trim() || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            添加 HRouter
          </Button>
        </div>
      )}
    </form>
  );
}
