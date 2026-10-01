import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Provider } from "@/types";
import { providersApi } from "@/lib/api";
import { useHRouterAccess } from "@/hooks/useHRouterAccess";

const auth = vi.hoisted(() => ({ session: null as any }));
vi.mock("@/hooks/useHRouterSession", () => ({
  useHRouterSession: () => auth.session,
}));
beforeEach(() => {
  auth.session = null;
  vi.restoreAllMocks();
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(useHRouterAccess, { wrapper }) };
}
describe("HRouter capability detection", () => {
  it("does not unlock account services from login alone", async () => {
    auth.session = { user: { id: 1 } };
    vi.spyOn(providersApi, "getAll").mockResolvedValue({});
    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connected).toBe(false);
    expect(result.current.cloudEnabled).toBe(false);
  });
  it("detects a key in any agent, then responds to provider deletion and login", async () => {
    let configured = true;
    vi.spyOn(providersApi, "getAll").mockImplementation(
      async (app): Promise<Record<string, Provider>> =>
        app === "hermes" && configured
          ? {
              h: {
                id: "h",
                name: "Custom",
                settingsConfig: {
                  base_url: "https://hrouter.net/v1",
                  api_key: "test-only-key",
                },
              },
            }
          : {},
    );
    const { result, rerender, client } = setup();
    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(result.current.cloudEnabled).toBe(false);
    auth.session = { user: { id: 1 } };
    rerender();
    expect(result.current.cloudEnabled).toBe(true);
    configured = false;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["providers", "hermes"] });
    });
    await waitFor(() => expect(result.current.connected).toBe(false));
    expect(result.current.cloudEnabled).toBe(false);
  });
});
