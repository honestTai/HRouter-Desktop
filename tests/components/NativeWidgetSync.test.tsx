import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeWidgetSync } from "@/components/widget/NativeWidgetSync";
import { APP_IDS } from "@/config/appConfig";

const mocks = vi.hoisted(() => ({
  isMac: vi.fn(() => true),
  snapshot: vi.fn(),
  finance: vi.fn(),
  selectAgent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/platform", () => ({ isMac: mocks.isMac }));
vi.mock("@/lib/api/usageWidget", () => ({ usageWidgetApi: mocks }));
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NativeWidgetSync app="claude" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.isMac.mockReturnValue(true);
  mocks.snapshot.mockImplementation(async (app) => ({
    app,
    financeEnabled: app === "codex",
    providerId: "p",
    providerRevision: "r",
  }));
  mocks.finance.mockResolvedValue({ plans: [] });
});
describe("native widget synchronization", () => {
  it("updates independently selected Agents, not only the visible workbench tab", async () => {
    mount();
    await waitFor(() =>
      expect(mocks.snapshot).toHaveBeenCalledTimes(APP_IDS.length),
    );
    for (const app of APP_IDS) expect(mocks.snapshot).toHaveBeenCalledWith(app);
    await waitFor(() =>
      expect(mocks.finance).toHaveBeenCalledWith("codex", "p", "r"),
    );
    expect(mocks.finance).toHaveBeenCalledTimes(1);
    expect(mocks.selectAgent).toHaveBeenCalledWith("claude");
  });
  it("does not run native-widget queries on Windows", () => {
    mocks.isMac.mockReturnValue(false);
    mount();
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.finance).not.toHaveBeenCalled();
    expect(mocks.selectAgent).not.toHaveBeenCalled();
  });
});
