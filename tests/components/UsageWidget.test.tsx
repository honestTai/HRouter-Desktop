import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsageWidget } from "@/components/widget/UsageWidget";
import { UsageMeter } from "@/components/widget/UsageMeter";
const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  finance: vi.fn(),
  minimize: vi.fn(),
  close: vi.fn(),
  pin: vi.fn(),
  maximize: vi.fn(),
  listeners: new Map<string, (e: any) => void>(),
}));
vi.mock("@/lib/api/usageWidget", () => ({
  usageWidgetApi: { snapshot: mocks.snapshot, finance: mocks.finance },
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
