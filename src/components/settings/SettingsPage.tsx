import { Card, CardContent } from "@/components/ui/card";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import hrouterLogo from "@/assets/icons/hrouter.svg";
import { AppVisibilitySettings } from "@/components/settings/AppVisibilitySettings";
import { LanguageSettings } from "@/components/settings/LanguageSettings";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { WindowSettings } from "@/components/settings/WindowSettings";
import { AgentManagerButton } from "@/components/AgentManagerButton";
import { HelpCenterButton } from "@/components/HelpCenterButton";
import { SupportGroupButton } from "@/components/SupportGroupButton";
import { UpdateBadge } from "@/components/UpdateBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings, type SettingsFormState } from "@/hooks/useSettings";
import { settingsApi } from "@/lib/api";
import { getCurrentVersion } from "@/lib/updater";

interface SettingsPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void | Promise<void>;
  defaultTab?: string;
}

const ESSENTIAL_TABS = new Set(["general", "about"]);

export function SettingsPage({
  open,
  defaultTab = "general",
}: SettingsPageProps) {
  const { t } = useTranslation();
  const {
    settings,
    isLoading,
    reloadSettings,
    updateSettings,
    autoSaveSettings,
    requiresRestart,
    acknowledgeRestart,
  } = useSettings();
  const [activeTab, setActiveTab] = useState("general");
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    if (!open) return;
    setActiveTab(ESSENTIAL_TABS.has(defaultTab) ? defaultTab : "general");
    void getCurrentVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, [defaultTab, open]);

  useEffect(() => {
    if (requiresRestart) setShowRestartPrompt(true);
  }, [requiresRestart]);

  const handleAutoSave = useCallback(
    async (updates: Partial<SettingsFormState>): Promise<boolean> => {
      if (!settings) return false;
      const previousValues = Object.fromEntries(
        Object.keys(updates).map((key) => [
          key,
          settings[key as keyof SettingsFormState],
        ]),
      ) as Partial<SettingsFormState>;

      updateSettings(updates);
      try {
        await autoSaveSettings(updates);
        return true;
      } catch (error) {
        console.error("[SettingsPage] Failed to autosave settings", error);
        updateSettings(previousValues);
        toast.error(
          t("settings.saveFailedGeneric", {
            defaultValue: "保存失败，请重试",
          }),
        );
        return false;
      }
    },
    [autoSaveSettings, settings, t, updateSettings],
  );

  const isBusy = useMemo(() => isLoading && !settings, [isLoading, settings]);

  const finishRestartPrompt = useCallback(() => {
    setShowRestartPrompt(false);
    acknowledgeRestart();
  }, [acknowledgeRestart]);

  const handleRestartNow = useCallback(async () => {
    if (import.meta.env.DEV) {
      toast.success(t("settings.devModeRestartHint"), { closeButton: true });
      finishRestartPrompt();
      return;
    }

    try {
      await settingsApi.restart();
    } catch (error) {
      console.error("[SettingsPage] Failed to restart app", error);
      toast.error(t("settings.restartFailed"));
      finishRestartPrompt();
    }
  }, [finishRestartPrompt, t]);

  if (!open) return null;

  return (
    <div className="h-full min-h-0 w-full flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      {isBusy ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mx-auto w-full max-w-6xl"
        >
          <TabsList className="mb-6 inline-flex">
            <TabsTrigger value="general">
              {t("settings.tabGeneral")}
            </TabsTrigger>
            <TabsTrigger value="about">{t("common.about")}</TabsTrigger>
          </TabsList>

          <div className="min-w-0 w-full">
            <TabsContent value="general" className="mt-0 space-y-5">
              {!settings && (
                <Card role="alert" className="shadow-none">
                  <CardContent className="space-y-4 p-6">
                    <p className="text-sm text-muted-foreground">
                      {t("workspaceUi.settingsUnavailable")}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => void reloadSettings()}
                    >
                      {t("common.retry")}
                    </Button>
                  </CardContent>
                </Card>
              )}
              {settings && (
                <>
                  <Card className="shadow-none">
                    <CardContent className="flex flex-wrap items-center gap-3 p-5">
                      <AgentManagerButton showLabel />
                      <HelpCenterButton showLabel />
                      <SupportGroupButton sidebar />
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="grid gap-6 p-5 lg:grid-cols-2">
                      <LanguageSettings
                        value={settings.language}
                        onChange={(language) =>
                          void handleAutoSave({ language })
                        }
                      />
                      <ThemeSettings />
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-5">
                      <AppVisibilitySettings
                        settings={settings}
                        onChange={(updates) => void handleAutoSave(updates)}
                      />
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardContent className="p-5">
                      <WindowSettings
                        settings={settings}
                        onChange={(updates) => void handleAutoSave(updates)}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="about" className="mt-0">
              <Card className="shadow-none">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 border-b border-border-default pb-6">
                    <img
                      src={hrouterLogo}
                      alt="HRouter"
                      className="h-12 w-12 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">HRouter Desktop</h2>
                      <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                        {t("app.description")}
                      </p>
                    </div>
                  </div>
                  <UpdateBadge className="my-4" />
                  <dl className="divide-y divide-border-default text-sm">
                    <div className="flex items-center justify-between gap-4 py-4">
                      <dt className="flex items-center gap-2 text-muted-foreground">
                        <Info className="h-4 w-4" />
                        {t("common.version")}
                      </dt>
                      <dd className="shrink-0 font-mono font-medium">
                        {version ? `v${version.replace(/^v/, "")}` : "-"}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      )}

      <Dialog
        open={showRestartPrompt}
        onOpenChange={(nextOpen) => !nextOpen && finishRestartPrompt()}
      >
        <DialogContent zIndex="alert" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.restartRequired")}</DialogTitle>
          </DialogHeader>
          <div className="px-6 text-sm text-muted-foreground">
            {t("settings.restartRequiredMessage")}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={finishRestartPrompt}>
              {t("settings.restartLater")}
            </Button>
            <Button type="button" onClick={() => void handleRestartNow()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("settings.restartNow")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
