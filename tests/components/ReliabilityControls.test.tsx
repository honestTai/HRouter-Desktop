import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReliabilityControls } from "@/components/access/ReliabilityControls";
import { EnvironmentTargets } from "@/components/access/EnvironmentTargets";
import { QuotaSummary } from "@/components/access/QuotaSummary";
import { accessApi } from "@/lib/api/access";
import { providersApi } from "@/lib/api";
import { usageApi } from "@/lib/api/usage";

function show(child: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // The main provider page uses a different data shape under this cache key.
  // Workbench queries must not consume or overwrite that cached result.
  for (const app of ["claude", "codex"]) {
    client.setQueryData(["providers", app], {
      providers: {},
      currentProviderId: "",
    });
  }
  return render(
    <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(providersApi, "getAll").mockResolvedValue({
    a: { id: "a", name: "Primary", settingsConfig: {} },
    b: { id: "b", name: "Backup", settingsConfig: {} },
  });
  vi.spyOn(accessApi, "modelRoutes").mockResolvedValue([]);
  vi.spyOn(providersApi, "updateTrayMenu").mockResolvedValue(true);
});
describe("Reliability controls", () => {
  it("saves an explicit ordered model route for the selected app", async () => {
    const user = userEvent.setup();
    const save = vi.spyOn(accessApi, "setModelRoutes").mockResolvedValue();
    show(<ReliabilityControls app="codex" />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "添加模型规则" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "添加模型规则" }));
    await user.type(screen.getByLabelText("路由模型 1"), "model-a");
    await user.selectOptions(screen.getByLabelText("路由 1 线路 1"), "a");
    await user.click(screen.getByRole("button", { name: "添加备用" }));
    await user.selectOptions(screen.getByLabelText("路由 1 线路 2"), "b");
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存模型路由" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("codex", [
        { model: "model-a", providers: ["a", "b"] },
      ]),
    );
  });
  it("previews environment paths before sending the checked deployment", async () => {
    const user = userEvent.setup();
    const targets = [
      {
        name: "Ubuntu",
        app: "codex",
        directory: "C:/fixture/.codex",
        providerId: "a",
      },
    ];
    vi.spyOn(accessApi, "environmentTargets").mockResolvedValue(targets);
    vi.spyOn(accessApi, "previewEnvironmentTargets").mockResolvedValue({
      fingerprint: "hash",
      files: ["C:/fixture/.codex/config.toml"],
    });
    const apply = vi
      .spyOn(accessApi, "applyEnvironmentTargets")
      .mockResolvedValue("C:/fixture/backup.json");
    show(<EnvironmentTargets />);
    await screen.findByDisplayValue("Ubuntu");
    await user.click(screen.getByRole("button", { name: "预览全部目标" }));
    await screen.findByText("C:/fixture/.codex/config.toml");
    expect(apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认写入全部目标" }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith(targets, "hash"));
  });
  it("does not sum possibly shared balances until independence is confirmed", async () => {
    const user = userEvent.setup();
    vi.mocked(accessApi.modelRoutes).mockResolvedValue([
      { model: "m", providers: ["a", "b"] },
    ]);
    const query = vi.spyOn(usageApi, "query").mockResolvedValue({
      success: true,
      data: [{ remaining: 5, unit: "USD" }],
    });
    show(<QuotaSummary app="claude" />);
    await screen.findByRole("option", { name: "m" });
    expect(query).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText("额度线路组"), "m");
    await user.click(screen.getByRole("button", { name: "刷新组内额度" }));
    await screen.findByLabelText(
      "确认这些 Key 及套餐的额度相互独立，按相同单位汇总",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("status")).toHaveTextContent("10 USD");
  });
});
