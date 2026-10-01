import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "i18next";
import zh from "@/i18n/locales/zh.json";
import type { AppId } from "@/lib/api";
import { RoutesPage } from "@/components/proxy/RoutesPage";
import { proxyApi } from "@/lib/api/proxy";
import { failoverApi } from "@/lib/api/failover";
import type { ProxyStatus, ProxyTakeoverStatus } from "@/types/proxy";
vi.mock("@/hooks/useHRouterSession", () => ({ useHRouterSession: () => null }));
let running: boolean;
let takeover: ProxyTakeoverStatus;
const onAdd = vi.fn();
function Wrapper({ initial }: { initial: AppId }) {
  const [app, setApp] = useState(initial);
  return <RoutesPage activeApp={app} onAppChange={setApp} onAdd={onAdd} />;
}
function show(initial: AppId = "claude") {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <Wrapper initial={initial} />
    </QueryClientProvider>,
  );
}
beforeEach(async () => {
  vi.restoreAllMocks();
  i18n.addResourceBundle("zh", "translation", zh, true, true);
  await i18n.changeLanguage("zh");
  running = false;
  takeover = {
    claude: false,
    codex: false,
    gemini: false,
    grokbuild: false,
    opencode: false,
    openclaw: false,
    hermes: false,
  };
  vi.spyOn(proxyApi, "getProxyStatus").mockImplementation(
    async () =>
      ({
        running,
        active_targets: [],
        failover_count: 0,
      }) as unknown as ProxyStatus,
  );
  vi.spyOn(proxyApi, "getProxyTakeoverStatus").mockImplementation(async () => ({
    ...takeover,
  }));
  vi.spyOn(proxyApi, "setProxyTakeoverForApp").mockImplementation(
    async (app, value) => {
      takeover[app as keyof ProxyTakeoverStatus] = value;
      running = value;
    },
  );
  vi.spyOn(failoverApi, "getFailoverQueue").mockResolvedValue([
    { providerId: "a", providerName: "Alpha", sortIndex: 0 },
  ]);
  vi.spyOn(failoverApi, "getAvailableProvidersForFailover").mockResolvedValue(
    [],
  );
  vi.spyOn(failoverApi, "getAutoFailoverEnabled").mockResolvedValue(false);
  vi.spyOn(failoverApi, "setAutoFailoverEnabled").mockResolvedValue(undefined);
});
describe("Route policies with real hooks and queue UI", () => {
  it("requires takeover confirmation and gates failover on real status", async () => {
    show();
    const failover = await screen.findByRole("switch");
    expect(failover).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
    expect(proxyApi.setProxyTakeoverForApp).not.toHaveBeenCalled();
    const enable = screen.getByRole("button", { name: "开启此应用本地路由" });
    await waitFor(() => expect(enable).toBeEnabled());
    fireEvent.click(enable);
    expect(proxyApi.setProxyTakeoverForApp).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "确定" }),
    );
    await waitFor(() =>
      expect(proxyApi.setProxyTakeoverForApp).toHaveBeenCalledWith(
        "claude",
        true,
      ),
    );
    await waitFor(() => expect(screen.getByRole("switch")).toBeEnabled());
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(failoverApi.setAutoFailoverEnabled).toHaveBeenCalledWith(
        "claude",
        true,
      ),
    );
  });
  it("uses selected Agent consistently for backup creation and queue reads", async () => {
    show();
    await screen.findByRole("switch");
    fireEvent.click(screen.getByRole("button", { name: "Codex" }));
    await waitFor(() =>
      expect(failoverApi.getFailoverQueue).toHaveBeenCalledWith("codex"),
    );
    fireEvent.click(screen.getByRole("button", { name: "添加备用供应商" }));
    expect(onAdd).toHaveBeenCalledWith("codex");
  });
  it("does not pretend OpenCode has supported failover", async () => {
    show("opencode");
    expect(
      await screen.findByText(zh.routePolicies.directMode),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OpenCode" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "OpenCode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(failoverApi.getFailoverQueue).not.toHaveBeenCalledWith("opencode");
  });
  it("surfaces native status failures without enabling writes", async () => {
    vi.mocked(proxyApi.getProxyStatus).mockRejectedValue(
      new Error("native bridge missing"),
    );
    show();
    expect(await screen.findByText("native bridge missing")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "开启此应用本地路由" }),
    ).toBeDisabled();
  });
});
