import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppId } from "@/lib/api/types";
import { providersApi, profilesApi } from "@/lib/api";
import { useProvidersQuery } from "@/lib/query/queries";
import { useSwitchProviderMutation } from "@/lib/query/mutations";
import { useApplyProfileMutation } from "@/lib/query/profiles";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => vi.restoreAllMocks());
describe("Agent data scope isolation", () => {
  it("does not expose previous Agent providers during a switch, or let a late result replace the active Agent", async () => {
    const { client, wrapper } = setup();
    const codex = deferred<any>();
    const all = vi
      .spyOn(providersApi, "getAll")
      .mockImplementation(async (app) =>
        app === "codex"
          ? codex.promise
          : { same: { id: "same", name: app, settingsConfig: {} } },
      );
    vi.spyOn(providersApi, "getCurrent").mockResolvedValue("same");
    const { result, rerender } = renderHook(
      ({ app }: { app: AppId }) => useProvidersQuery(app),
      { wrapper, initialProps: { app: "claude" as AppId } },
    );
    await waitFor(() =>
      expect(result.current.data?.providers.same.name).toBe("claude"),
    );
    rerender({ app: "codex" });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
    rerender({ app: "gemini" });
    await waitFor(() =>
      expect(result.current.data?.providers.same.name).toBe("gemini"),
    );
    await act(async () =>
      codex.resolve({
        same: { id: "same", name: "codex", settingsConfig: {} },
      }),
    );
    expect(result.current.data?.providers.same.name).toBe("gemini");
    expect(all).toHaveBeenCalledWith("codex");
    expect(client.getQueryData(["providers", "gemini"])).toMatchObject({
      currentProviderId: "same",
    });
  });
  it("reports failed scope reads instead of returning an empty successful configuration", async () => {
    const { wrapper } = setup();
    vi.spyOn(providersApi, "getAll").mockRejectedValue(
      new Error("Agent read failed"),
    );
    vi.spyOn(providersApi, "getCurrent").mockResolvedValue("same");
    const { result } = renderHook(() => useProvidersQuery("pi"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
  it("finishes a pending write in its original Agent and refreshes all representations of that Agent", async () => {
    const { client, wrapper } = setup();
    const done = deferred<{ warnings: string[] }>();
    const write = vi
      .spyOn(providersApi, "switch")
      .mockReturnValue(done.promise);
    vi.spyOn(providersApi, "updateTrayMenu").mockResolvedValue(true);
    const invalidated = vi.spyOn(client, "invalidateQueries");
    const { result, rerender } = renderHook(
      ({ app }: { app: AppId }) => useSwitchProviderMutation(app),
      { wrapper, initialProps: { app: "pi" as AppId } },
    );
    let task!: Promise<unknown>;
    act(() => {
      task = result.current.mutateAsync("same");
    });
    await waitFor(() => expect(write).toHaveBeenCalledWith("same", "pi"));
    rerender({ app: "codex" });
    await act(async () => {
      done.resolve({ warnings: [] });
      await task;
    });
    expect(write).toHaveBeenCalledTimes(1);
    for (const key of [
      "providers",
      "agent-access",
      "profile-preview",
      "direct-routes",
    ]) {
      expect(invalidated).toHaveBeenCalledWith({ queryKey: [key, "pi"] });
      expect(invalidated).not.toHaveBeenCalledWith({
        queryKey: [key, "codex"],
      });
    }
  });
  it("invalidates the applied profile scope, including Agents added after the original three", async () => {
    const { client, wrapper } = setup();
    const apply = vi.spyOn(profilesApi, "apply").mockResolvedValue([]);
    vi.spyOn(providersApi, "updateTrayMenu").mockResolvedValue(true);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useApplyProfileMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "profile", scope: "workbuddy" });
    });
    expect(apply).toHaveBeenCalledWith("profile", "workbuddy");
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["providers", "workbuddy"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["direct-routes", "workbuddy"],
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ["providers", "claude"],
    });
  });
});
