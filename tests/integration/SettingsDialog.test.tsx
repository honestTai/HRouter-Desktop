import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { getSettings, resetProviderState } from "../msw/state";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/updater", () => ({
  getCurrentVersion: vi.fn().mockResolvedValue("0.2.4"),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

const TabsContext = React.createContext<{
  value: string;
  onValueChange?: (value: string) => void;
}>({ value: "general" });

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ value, onValueChange, children }: any) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      {children}
    </TabsContext.Provider>
  ),
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ value, children }: any) => {
    const context = React.useContext(TabsContext);
    return (
      <button type="button" onClick={() => context.onValueChange?.(value)}>
        {children}
      </button>
    );
  },
  TabsContent: ({ value, children }: any) => {
    const context = React.useContext(TabsContext);
    return context.value === value ? (
      <div data-testid={`tab-${value}`}>{children}</div>
    ) : null;
  },
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
  AppVisibilitySettings: () => <div>app-visibility</div>,
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

const renderSettings = (
  props?: Partial<React.ComponentProps<typeof SettingsPage>>,
) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<div data-testid="loading">loading</div>}>
        <SettingsPage open onOpenChange={() => {}} {...props} />
      </Suspense>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  resetProviderState();
  window.localStorage.clear();
});

describe("SettingsPage integration", () => {
  it("loads the retained settings from the backend", async () => {
    renderSettings();

    expect(await screen.findByText("language:zh")).toBeInTheDocument();
    expect(screen.getByText("theme-settings")).toBeInTheDocument();
    expect(screen.getByText("app-visibility")).toBeInTheDocument();
    expect(screen.getByText("window-settings")).toBeInTheDocument();
  });

  it("autosaves language changes", async () => {
    renderSettings();
    await screen.findByText("language:zh");

    fireEvent.click(screen.getByText("change-language"));

    await waitFor(() => expect(getSettings().language).toBe("en"));
    expect(window.localStorage.getItem("language")).toBe("en");
  });

  it("autosaves window behavior changes", async () => {
    renderSettings();
    await screen.findByText("window-settings");

    fireEvent.click(screen.getByText("window-settings"));

    await waitFor(() =>
      expect(getSettings().minimizeToTrayOnClose).toBe(false),
    );
  });

  it("does not expose removed settings sections", async () => {
    renderSettings({ defaultTab: "advanced" });
    await screen.findByText("language:zh");

    expect(screen.getByTestId("tab-general")).toBeInTheDocument();
    expect(screen.queryByText("settings.tabAdvanced")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.tabProxy")).not.toBeInTheDocument();
    expect(screen.queryByText("usage.title")).not.toBeInTheDocument();
  });
});
