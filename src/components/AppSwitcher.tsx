import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { AppId } from "@/lib/api";
import type { VisibleApps } from "@/types";
import { ProviderIcon } from "@/components/ProviderIcon";
import { cn } from "@/lib/utils";
import { CheckCircle2, Monitor, Terminal } from "lucide-react";

const APP_BADGE_ICON: Partial<
  Record<AppId, { icon: typeof Terminal; offsetY?: number }>
> = {
  claude: { icon: Terminal },
  "claude-desktop": { icon: Monitor, offsetY: 0.5 },
};

interface AppSwitcherProps {
  activeApp: AppId;
  onSwitch: (app: AppId) => void;
  visibleApps?: VisibleApps;
}

const ALL_APPS: AppId[] = [
  "claude",
  "claude-desktop",
  "codex",
  "gemini",
  "grokbuild",
  "opencode",
  "openclaw",
  "hermes",
  "pi",
  "deepseek-harness",
  "workbuddy",
];
const STORAGE_KEY = "hrouter-last-app";

const APP_ICON_NAME: Record<AppId, string> = {
  claude: "claude",
  "claude-desktop": "claude",
  codex: "openai",
  gemini: "gemini",
  grokbuild: "grok",
  opencode: "opencode",
  openclaw: "openclaw",
  hermes: "hermes",
  pi: "pi",
  "deepseek-harness": "deepseek",
  workbuddy: "workbuddy",
};

const APP_DISPLAY_NAME: Record<AppId, string> = {
  claude: "Claude Code",
  "claude-desktop": "Claude Desktop",
  codex: "Codex",
  gemini: "Gemini",
  grokbuild: "Grok Build",
  opencode: "OpenCode",
  openclaw: "OpenClaw",
  hermes: "Hermes",
  pi: "Pi Agent",
  "deepseek-harness": "DeepSeek Harness",
  workbuddy: "WorkBuddy",
};

/** 应用图标 + 角标（Claude Code / Desktop 用角标区分终端与桌面） */
function AppGlyph({ app, isActive }: { app: AppId; isActive: boolean }) {
  const badgeConfig = APP_BADGE_ICON[app];
  const BadgeIcon = badgeConfig?.icon;
  return (
    <span className="relative inline-flex shrink-0">
      <ProviderIcon
        icon={APP_ICON_NAME[app]}
        name={APP_DISPLAY_NAME[app]}
        size={20}
      />
      {BadgeIcon && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-[3px] border h-[11px] w-[11px]",
            isActive
              ? "bg-background border-border text-foreground"
              : "bg-muted border-background text-muted-foreground group-hover:bg-background group-hover:text-foreground",
          )}
          aria-hidden="true"
        >
          <BadgeIcon
            className="h-[8px] w-[8px]"
            strokeWidth={2.5}
            style={
              badgeConfig?.offsetY
                ? { transform: `translateY(${badgeConfig.offsetY}px)` }
                : undefined
            }
          />
        </span>
      )}
    </span>
  );
}

export function AppSwitcher({
  activeApp,
  onSwitch,
  visibleApps,
}: AppSwitcherProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const revealSelection = () => {
      const selected = container.querySelector<HTMLElement>(
        '[aria-pressed="true"]',
      );
      if (!selected) return;
      const outer = container.getBoundingClientRect();
      const inner = selected.getBoundingClientRect();
      if (inner.left < outer.left)
        container.scrollLeft += inner.left - outer.left - 4;
      else if (inner.right > outer.right)
        container.scrollLeft += inner.right - outer.right + 4;
    };
    revealSelection();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(revealSelection);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeApp]);
  const handleSwitch = (app: AppId) => {
    if (app === activeApp) return;
    localStorage.setItem(STORAGE_KEY, app);
    onSwitch(app);
  };

  // Filter apps based on visibility settings (default all visible)
  const appsToShow = ALL_APPS.filter((app) => {
    if (!visibleApps) return true;
    return visibleApps[app] !== false;
  });
  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={t("agentContext.current")}
      className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1"
      style={{ WebkitAppRegion: "no-drag" } as any}
    >
      {appsToShow.map((app) => (
        <Button
          key={app}
          type="button"
          variant={activeApp === app ? "default" : "ghost"}
          size="sm"
          onClick={() => handleSwitch(app)}
          aria-label={APP_DISPLAY_NAME[app]}
          title={
            activeApp === app
              ? `${t("agentContext.current")}: ${APP_DISPLAY_NAME[app]}`
              : APP_DISPLAY_NAME[app]
          }
          aria-pressed={activeApp === app}
          className={cn(
            "shrink-0 gap-2",
            activeApp === app &&
              "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary ring-offset-1 ring-offset-background hover:bg-primary/90",
          )}
        >
          <AppGlyph app={app} isActive={activeApp === app} />
          <span>{APP_DISPLAY_NAME[app]}</span>
          {activeApp === app && (
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          )}
        </Button>
      ))}
    </div>
  );
}
