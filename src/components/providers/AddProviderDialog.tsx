import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FullScreenPanel } from "@/components/common/FullScreenPanel";
import type { Provider } from "@/types";
import type { AppId } from "@/lib/api";
import type { ProviderFormValues } from "@/components/providers/forms/ProviderForm";
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
}

export function AddProviderDialog({
  open,
  onOpenChange,
  appId,
  onSubmit,
}: AddProviderDialogProps) {
  const { t } = useTranslation();
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

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
      title={`添加 HRouter · ${t(`apps.${appId}`)}`}
      onClose={() => onOpenChange(false)}
      contentClassName="pt-3"
      footer={
        <>
          <span className="mr-auto min-w-0 truncate text-xs text-muted-foreground">
            只需输入 Key，HRouter 会自动导入并预填当前 Agent 的模型映射。
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
            添加 HRouter
          </Button>
        </>
      }
    >
      <HRouterProviderForm
        appId={appId}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
        onSubmittingChange={setIsFormSubmitting}
        showButtons={false}
      />
    </FullScreenPanel>
  );
}
