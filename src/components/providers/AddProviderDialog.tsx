import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FullScreenPanel } from "@/components/common/FullScreenPanel";
import type { Provider } from "@/types";
import type { AppId } from "@/lib/api";
import {
  ProviderForm,
  type ProviderFormValues,
} from "@/components/providers/forms/ProviderForm";
import { HRouterProviderForm } from "@/components/providers/forms/HRouterProviderForm";
import type { OpenClawSuggestedDefaults } from "@/config/openclawProviderPresets";

interface HRouterProviderInput extends Omit<Provider, "id"> {
  providerKey?: string;
  suggestedDefaults?: OpenClawSuggestedDefaults;
}

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: AppId;
  onSubmit: (provider: HRouterProviderInput) => Promise<void> | void;
  initialMode?: "general" | "hrouter";
}

export function AddProviderDialog({
  open,
  onOpenChange,
  appId,
  onSubmit,
  initialMode = "general",
}: AddProviderDialogProps) {
  const { t } = useTranslation();
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [mode, setMode] = useState(initialMode);
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setIsFormSubmitting(false);
    }
  }, [open, appId, initialMode]);

  const handleSubmit = useCallback(
    async (values: ProviderFormValues) => {
      const providerData: HRouterProviderInput = {
        name: values.name.trim(),
        notes: values.notes?.trim() || undefined,
        websiteUrl: values.websiteUrl?.trim() || undefined,
        settingsConfig: JSON.parse(values.settingsConfig) as Record<
          string,
          unknown
        >,
        icon: values.icon?.trim() || undefined,
        iconColor: values.iconColor?.trim() || undefined,
        ...(values.presetCategory ? { category: values.presetCategory } : {}),
        ...(values.meta ? { meta: values.meta } : {}),
      };

      if (
        (appId === "opencode" || appId === "openclaw" || appId === "hermes") &&
        values.providerKey
      ) {
        providerData.providerKey = values.providerKey;
      }
      if (appId === "openclaw" && values.suggestedDefaults) {
        providerData.suggestedDefaults = values.suggestedDefaults;
      }

      await onSubmit(providerData);
      onOpenChange(false);
    },
    [appId, onOpenChange, onSubmit],
  );

  return (
    <FullScreenPanel
      isOpen={open}
      title={t("accessWorkbench.addProviderTitle", {
        defaultValue: "添加供应商 · {{value0}}",
        value0: t(`apps.${appId}`),
      })}
      onClose={() => onOpenChange(false)}
      contentClassName="pt-3"
      footer={
        <>
          <span className="mr-auto min-w-0 truncate text-xs text-muted-foreground">
            {mode === "hrouter"
              ? t("accessWorkbench.enterAnHrouterKeyToDiscoverModelsAndUsage", {
                  defaultValue: "输入 HRouter Key，自动识别模型与用量。",
                })
              : t(
                  "accessWorkbench.connectAnOfficialServiceYourOwnEndpointOrA",
                  {
                    defaultValue: "接入官方服务、自建端点或任意兼容的中转站。",
                  },
                )}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="provider-form"
            disabled={isFormSubmitting}
          >
            <Plus className="mr-2 h-4 w-4" />
            {mode === "hrouter"
              ? t("accessWorkbench.addHrouter", {
                  defaultValue: "添加 HRouter",
                })
              : t("accessWorkbench.addProvider", {
                  defaultValue: "添加供应商",
                })}
          </Button>
        </>
      }
    >
      <div
        className="mb-4 flex gap-2"
        role="group"
        aria-label={t("accessWorkbench.connectionMethod", {
          defaultValue: "接入方式",
        })}
      >
        <Button
          type="button"
          variant={mode === "general" ? "default" : "outline"}
          disabled={isFormSubmitting}
          onClick={() => setMode("general")}
        >
          {t("accessWorkbench.generalConnection", { defaultValue: "通用接入" })}
        </Button>
        <Button
          type="button"
          variant={mode === "hrouter" ? "default" : "outline"}
          disabled={isFormSubmitting}
          onClick={() => setMode("hrouter")}
        >
          {t("accessWorkbench.quickHrouterSetup", {
            defaultValue: "HRouter 快捷接入",
          })}
        </Button>
      </div>
      {mode === "hrouter" ? (
        <HRouterProviderForm
          key={`hrouter-${appId}`}
          appId={appId}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          onSubmittingChange={setIsFormSubmitting}
          showButtons={false}
        />
      ) : (
        <ProviderForm
          key={`general-${appId}`}
          appId={appId}
          submitLabel={t("accessWorkbench.addProvider", {
            defaultValue: "添加供应商",
          })}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          onSubmittingChange={setIsFormSubmitting}
          showButtons={false}
        />
      )}
    </FullScreenPanel>
  );
}
