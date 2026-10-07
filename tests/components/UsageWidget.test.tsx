import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UsageWidget,
  initialWidgetAgent,
} from "@/components/widget/UsageWidget";
import { UsageMeter } from "@/components/widget/UsageMeter";
const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  selectAgent: vi.fn().mockResolvedValue(undefined),
  finance: vi.fn(),
  minimize: vi.fn(),
  close: vi.fn(),
  pin: vi.fn(),
  maximize: vi.fn(),
  listeners: new Map<string, (e: any) => void>(),
}));
vi.mock("@/lib/api/usageWidget", () => ({
  usageWidgetApi: {
    snapshot: mocks.snapshot,
    finance: mocks.finance,
    selectAgent: mocks.selectAgent,
  },
}));
vi.mock("@/lib/api/usage", () => ({
  usageApi: { syncSessionUsage: async () => ({ imported: 0, errors: [] }) },
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: async (name: string, fn: any) => {
    mocks.listeners.set(name, fn);
    return () => mocks.listeners.delete(name);
  },
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: mocks.minimize,
    close: mocks.close,
    setAlwaysOnTop: mocks.pin,
    toggleMaximize: mocks.maximize,
  }),
}));
function snapshot(app = "claude", extra = {}) {
  return {
    app,
    providerId: "same-id",
    providerName: `${app}-provider`,
    providerRevision: app,
    financeEnabled: true,
    summary: {
      totalRequests: 2,
      realTotalTokens: 100,
      totalInputTokens: 30,
      totalOutputTokens: 20,
      totalCacheCreationTokens: 10,
      totalCacheReadTokens: 40,
      cacheHitRate: 0.5,
      totalCost: "999.9876",
    },
    tokensPerSecond: 20,
    speedSamples: 1,
    measuredAt: 1700000000,
    ...extra,
  };
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <UsageWidget />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  mocks.snapshot.mockReset();
  mocks.finance.mockReset();
  mocks.listeners.clear();
  mocks.selectAgent.mockClear();
  [mocks.minimize, mocks.close, mocks.pin, mocks.maximize].forEach((fn) =>
    fn.mockReset().mockResolvedValue(undefined),
  );
  mocks.snapshot.mockImplementation(async (app) => snapshot(app));
  mocks.finance.mockResolvedValue({
    todayCost: 0.0123,
    unit: "CNY",
    plans: [{ remaining: 20, unit: "CNY", planName: "Wallet" }],
  });
});
describe("usage widget", () => {
  it("shows returned actual money, not model-price estimates or invented quota totals", async () => {
    mount();
    expect(await screen.findByText("Wallet")).toBeVisible();
    expect(screen.getByText("0.0123 CNY")).toBeVisible();
    expect(screen.queryByText(/999.9876/)).toBeNull();
    expect(
      screen.queryByRole("progressbar", { name: "usageWidget.used" }),
    ).toBeNull();
    expect(mocks.finance).toHaveBeenCalledWith("claude", "same-id", "claude");
  });
  it("shows key spend and server throughput without calling them wallet quota or generation speed", async () => {
    mocks.snapshot.mockResolvedValue(
      snapshot("claude", { tokensPerSecond: null, speedSamples: 0 }),
    );
    mocks.finance.mockResolvedValue({
      totalSpent: 412.97,
      tokensPerMinute: 2400,
      unit: "CNY",
      plans: [{ remaining: 4867.32, planName: "Wallet", unit: "CNY" }],
    });
    mount();
    expect(await screen.findByText("412.97 CNY")).toBeVisible();
    expect(screen.getByText("usageWidget.throughput")).toBeVisible();
    expect(screen.getByText("usageWidget.speedUnavailable")).toBeVisible();
    expect(screen.queryByText("usageWidget.used")).toBeNull();
    expect(screen.queryByText("40.0 tok/s")).toBeNull();
  });
  it("does not fabricate daily spend from the used quota", async () => {
    mocks.finance.mockResolvedValue({
      plans: [{ used: 45, total: 100, remaining: 55, unit: "USD" }],
    });
    mount();
    expect(
      await screen.findByRole("progressbar", { name: "usageWidget.used" }),
    ).toHaveAttribute("aria-valuenow", "45");
    expect(screen.queryByText("usageWidget.todayCost")).toBeNull();
  });
  it("does not query a random key for an Agent without a single active provider", async () => {
    mocks.snapshot.mockResolvedValue(
      snapshot("claude", {
        providerId: null,
        financeEnabled: false,
        providerName: null,
      }),
    );
    mount();
    expect(await screen.findByText("usageWidget.noProvider")).toBeVisible();
    expect(mocks.finance).not.toHaveBeenCalled();
  });
  it("uses native minimize/maximize controls and keeps resizing separate from the main window", async () => {
    mount();
    await screen.findByText("claude-provider");
    fireEvent.click(
      screen.getByRole("button", { name: "usageWidget.minimize" }),
    );
    await waitFor(() => expect(mocks.minimize).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "usageWidget.maximize" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "usageWidget.maximize" }),
    );
    await waitFor(() => expect(mocks.maximize).toHaveBeenCalledTimes(1));
    fireEvent.click(
      screen.getByRole("button", { name: "usageWidget.enlarge" }),
    );
    expect(document.documentElement.style.fontSize).toBe("18px");
  });
  it("switches Agent and clears the previous provider finance while the new query is pending", async () => {
    mount();
    await screen.findByText("Wallet");
    mocks.finance.mockImplementation((app) =>
      app === "codex" ? new Promise(() => {}) : Promise.resolve({ plans: [] }),
    );
    await act(async () =>
      mocks.listeners.get("usage-widget-agent")?.({ payload: "codex" }),
    );
    expect(await screen.findByText("codex-provider")).toBeVisible();
    expect(screen.queryByText("Wallet")).toBeNull();
    expect(mocks.finance).toHaveBeenCalledWith("codex", "same-id", "codex");
  });
  it("selects an Agent from the widget without changing the workbench selection", async () => {
    localStorage.setItem("hrouter-last-app", "claude");
    mount();
    await screen.findByText("Wallet");
    mocks.finance.mockImplementation((app) =>
      app === "codex" ? new Promise(() => {}) : Promise.resolve({ plans: [] }),
    );
    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "usageWidget.selectAgent" }),
      { key: "ArrowDown" },
    );
    expect(await screen.findAllByRole("option")).toHaveLength(11);
    fireEvent.click(screen.getByRole("option", { name: "Codex" }));
    expect(await screen.findByText("codex-provider")).toBeVisible();
    expect(screen.queryByText("Wallet")).toBeNull();
    expect(localStorage.getItem("hrouter-widget-agent")).toBe("codex");
    expect(localStorage.getItem("hrouter-last-app")).toBe("claude");
    expect(initialWidgetAgent()).toBe("codex");
    expect(mocks.selectAgent).toHaveBeenLastCalledWith("codex");
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: "hrouter-last-app",
        newValue: "gemini",
      }),
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Codex");
  });
  it("shows zero TPM as an idle server window, not zero generation speed", async () => {
    mocks.snapshot.mockResolvedValue(
      snapshot("claude", { tokensPerSecond: null, speedSamples: 0 }),
    );
    mocks.finance.mockResolvedValue({ tokensPerMinute: 0, plans: [] });
    mount();
    expect(await screen.findByText("usageWidget.throughputIdle")).toBeVisible();
    expect(screen.getByText("usageWidget.speedUnavailable")).toBeVisible();
    expect(screen.queryByText("0 tok/min")).toBeNull();
    expect(screen.queryByText("0.0 tok/s")).toBeNull();
  });
  it("labels an older measured speed and shows throughput separately even with a timed sample", async () => {
    mocks.snapshot.mockResolvedValue(
      snapshot("claude", { speedMeasuredAt: 1699999000 }),
    );
    mocks.finance.mockResolvedValue({ tokensPerMinute: 2400, plans: [] });
    mount();
    expect(await screen.findByText("usageWidget.throughput")).toBeVisible();
    expect(screen.getByText("20.0 tok/s")).toBeVisible();
    expect(screen.getByText("usageWidget.lastSpeedHint")).toBeVisible();
    expect(screen.queryByText("usageWidget.speedHint")).toBeNull();
  });
  it("clamps visual meters and does not create percentages for unknown limits", () => {
    const { rerender } = render(
      <UsageMeter label="quota" value={120} total={100} display="120" />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    rerender(<UsageMeter label="quota" value={0} total={0} display="—" />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
