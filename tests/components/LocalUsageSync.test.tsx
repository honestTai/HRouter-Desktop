import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usageApi } from "@/lib/api/usage";
import { LocalUsageSync } from "@/components/usage/LocalUsageSync";

function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <LocalUsageSync />
    </QueryClientProvider>,
  );
  return { client, invalidate };
}
beforeEach(() => vi.restoreAllMocks());
describe("local session usage import", () => {
  it("incrementally imports on mount and refreshes usage queries", async () => {
    const sync = vi.spyOn(usageApi, "syncSessionUsage").mockResolvedValue({
      imported: 3,
      skipped: 1,
      filesScanned: 2,
      errors: [],
      deferredFiles: 0,
      suspectedDuplicates: 0,
    });
    const { invalidate } = show();
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("status")).toBeNull();
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["usage"] }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "localAnalytics.sync" }),
    );
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toBeVisible();
  });
  it("surfaces an import error and lets the user retry without rebuilding", async () => {
    const sync = vi
      .spyOn(usageApi, "syncSessionUsage")
      .mockRejectedValueOnce(new Error("unavailable"));
    const rebuild = vi.spyOn(usageApi, "rebuildCodexUsage");
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "localAnalytics.syncFailed",
    );
    sync.mockResolvedValue({
      imported: 0,
      skipped: 0,
      filesScanned: 0,
      errors: [],
      deferredFiles: 0,
      suspectedDuplicates: 0,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "localAnalytics.sync" }),
    );
    await screen.findByRole("status");
    expect(rebuild).not.toHaveBeenCalled();
  });
});
