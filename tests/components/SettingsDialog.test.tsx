import { createContext, useContext, type ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/components/settings/SettingsPage";

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const tMock = vi.fn((key: string) => key);

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: tMock }),
}));

interface SettingsMock {
  settings: Record<string, unknown> | null;
  isLoading: boolean;
  requiresRestart: boolean;
  updateSettings: ReturnType<typeof vi.fn>;
  autoSaveSettings: ReturnType<typeof vi.fn>;
  acknowledgeRestart: ReturnType<typeof vi.fn>;
}

const createSettingsMock = (
  overrides: Partial<SettingsMock> = {},
): SettingsMock => ({
  settings: {
    language: "zh",
    theme: "system",
    minimizeToTrayOnClose: true,
    visibleApps: ["claude", "codex"],
  },
  isLoading: false,
  requiresRestart: false,
  updateSettings: vi.fn(),
  autoSaveSettings: vi.fn().mockResolvedValue({ requiresRestart: false }),
  acknowledgeRestart: vi.fn(),
  ...overrides,
});

let settingsMock = createSettingsMock();

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => settingsMock,
}));

const restartMock = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/api", () => ({
  settingsApi: { restart: (...args: unknown[]) => restartMock(...args) },
}));

vi.mock("@/lib/updater", () => ({
  getCurrentVersion: vi.fn().mockResolvedValue("0.2.4"),
}));

const TabsContext = createContext<{
  value: string;
  onValueChange?: (value: string) => void;
}>({ value: "general" });

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ value, onValueChange, children }: any) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div data-testid="tabs">{children}</div>
    </TabsContext.Provider>
  ),
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ value, children }: any) => {
    const context = useContext(TabsContext);
    return (
      <button type="button" onClick={() => context.onValueChange?.(value)}>
        {children}
      </button>
    );
  },
  TabsContent: ({ value, children }: any) => {
    const context = useContext(TabsContext);
    return context.value === value ? (
      <div data-testid={`tab-${value}`}>{children}</div>
    ) : null;
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock("@/components/settings/LanguageSettings", () => ({
  LanguageSettings: ({ value, onChange }: any) => (
    <div>
      <span>language:{value}</span>
      <button type="button" onClick={() => onChange("en")}>
        change-language
      </button>
    </div>
  ),
}));

vi.mock("@/components/settings/ThemeSettings", () => ({
  ThemeSettings: () => <div>theme-settings</div>,
}));

vi.mock("@/components/settings/AppVisibilitySettings", () => ({
  AppVisibilitySettings: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange({ visibleApps: ["codex"] })}>
      app-visibility
    </button>
  ),
}));

vi.mock("@/components/settings/WindowSettings", () => ({
  WindowSettings: ({ onChange }: any) => (
    <button
      type="button"
      onClick={() => onChange({ minimizeToTrayOnClose: false })}
    >
      window-settings
    </button>
  ),
}));

const renderSettingsPage = (
  props?: Partial<ComponentProps<typeof SettingsPage>>,
) => render(<SettingsPage open={true} onOpenChange={vi.fn()} {...props} />);

describe("SettingsPage", () => {
  beforeEach(() => {
    settingsMock = createSettingsMock();
    tMock.mockClear();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    restartMock.mockClear();
  });

  it("shows a loading state until settings are ready", () => {
    settingsMock = createSettingsMock({ settings: null, isLoading: true });

    renderSettingsPage();

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("language:zh")).not.toBeInTheDocument();
  });

  it("only exposes the essential general and about sections", () => {
    renderSettingsPage();

    expect(screen.getByText("settings.tabGeneral")).toBeInTheDocument();
    expect(screen.getByText("common.about")).toBeInTheDocument();
    expect(screen.queryByText("settings.tabAdvanced")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.tabProxy")).not.toBeInTheDocument();
    expect(screen.queryByText("usage.title")).not.toBeInTheDocument();
    expect(screen.getByText("language:zh")).toBeInTheDocument();
    expect(screen.getByText("theme-settings")).toBeInTheDocument();
  });

  it("autosaves all retained settings", async () => {
    renderSettingsPage();

    fireEvent.click(screen.getByText("change-language"));
    fireEvent.click(screen.getByText("app-visibility"));
    fireEvent.click(screen.getByText("window-settings"));

    expect(settingsMock.updateSettings).toHaveBeenNthCalledWith(1, {
      language: "en",
    });
    expect(settingsMock.updateSettings).toHaveBeenNthCalledWith(2, {
      visibleApps: ["codex"],
    });
    expect(settingsMock.updateSettings).toHaveBeenNthCalledWith(3, {
      minimizeToTrayOnClose: false,
    });
    await waitFor(() =>
      expect(settingsMock.autoSaveSettings).toHaveBeenCalledTimes(3),
    );
  });

  it("falls back to general when a removed tab is requested", () => {
    renderSettingsPage({ defaultTab: "advanced" });

    expect(screen.getByTestId("tab-general")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-advanced")).not.toBeInTheDocument();
  });

  it("shows HRouter product information in about", async () => {
    renderSettingsPage({ defaultTab: "about" });

    expect(screen.getByText("HRouter Desktop")).toBeInTheDocument();
    expect(await screen.findByText("v0.2.4")).toBeInTheDocument();
  });

  it("acknowledges restart after the development restart action", async () => {
    settingsMock = createSettingsMock({ requiresRestart: true });
    renderSettingsPage();

    fireEvent.click(await screen.findByText("settings.restartNow"));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "settings.devModeRestartHint",
        expect.objectContaining({ closeButton: true }),
      );
      expect(settingsMock.acknowledgeRestart).toHaveBeenCalledTimes(1);
    });
    expect(restartMock).not.toHaveBeenCalled();
  });

  it("allows postponing a required restart without closing settings", async () => {
    const onOpenChange = vi.fn();
    settingsMock = createSettingsMock({ requiresRestart: true });
    renderSettingsPage({ onOpenChange });

    fireEvent.click(await screen.findByText("settings.restartLater"));

    await waitFor(() =>
      expect(settingsMock.acknowledgeRestart).toHaveBeenCalledTimes(1),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(restartMock).not.toHaveBeenCalled();
  });
});
