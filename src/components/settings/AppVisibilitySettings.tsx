import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { ProviderIcon } from "@/components/ProviderIcon";
import type { SettingsFormState } from "@/hooks/useSettings";
import type { VisibleApps } from "@/types";
import type { AppId } from "@/lib/api";

interface AppVisibilitySettingsProps {
  settings: SettingsFormState;
  onChange: (updates: Partial<SettingsFormState>) => void;
}

const APP_CONFIG: Array<{
  id: AppId;
  icon: string;
  nameKey: string;
}> = [
  { id: "claude", icon: "claude", nameKey: "apps.claudeCode" },
  {
    id: "claude-desktop",
    icon: "claude",
    nameKey: "apps.claudeDesktop",
  },
  { id: "codex", icon: "openai", nameKey: "apps.codex" },
  { id: "gemini", icon: "gemini", nameKey: "apps.gemini" },
  { id: "grokbuild", icon: "grok", nameKey: "apps.grokbuild" },
  { id: "opencode", icon: "opencode", nameKey: "apps.opencode" },
  { id: "openclaw", icon: "openclaw", nameKey: "apps.openclaw" },
  { id: "hermes", icon: "hermes", nameKey: "apps.hermes" },
  { id: "pi", icon: "pi", nameKey: "apps.pi" },
  {
    id: "deepseek-harness",
    icon: "deepseek",
    nameKey: "apps.deepseek-harness",
  },
  { id: "workbuddy", icon: "workbuddy", nameKey: "apps.workbuddy" },
];

export function AppVisibilitySettings({
  settings,
  onChange,
}: AppVisibilitySettingsProps) {
  const { t } = useTranslation();

  const visibleApps: VisibleApps = settings.visibleApps ?? {
    claude: true,
    "claude-desktop": true,
    codex: true,
    gemini: true,
    grokbuild: true,
    opencode: true,
    openclaw: true,
    hermes: true,
  };

  // Count how many apps are currently visible
  const visibleCount = APP_CONFIG.filter(
    (app) => visibleApps[app.id] !== false,
  ).length;

  const handleToggle = (appId: AppId) => {
    const isCurrentlyVisible = visibleApps[appId] !== false;
    // Prevent disabling the last visible app
    if (isCurrentlyVisible && visibleCount <= 1) return;

    onChange({
      visibleApps: {
        ...visibleApps,
        [appId]: !isCurrentlyVisible,
      },
    });
  };

  return (
    <section className="space-y-2">
      <header className="space-y-1">
        <h3 className="text-sm font-medium">
          {t("settings.appVisibility.title")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.appVisibility.description")}
        </p>
      </header>
      <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {APP_CONFIG.map((app) => {
          const isVisible = visibleApps[app.id] !== false;
          // Disable button if this is the last visible app
          const isDisabled = isVisible && visibleCount <= 1;

          return (
            <label
              key={app.id}
              className="flex items-center gap-3 rounded-lg border bg-background p-3"
            >
              <ProviderIcon icon={app.icon} name={t(app.nameKey)} size={20} />
              <span className="min-w-0 flex-1 text-sm">{t(app.nameKey)}</span>
              <Switch
                checked={isVisible}
                disabled={isDisabled}
                onCheckedChange={() => handleToggle(app.id)}
                aria-label={t(app.nameKey)}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
