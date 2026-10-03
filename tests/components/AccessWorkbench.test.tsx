import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import i18n from "i18next";
import en from "@/i18n/locales/en.json";
import zh from "@/i18n/locales/zh.json";
import ja from "@/i18n/locales/ja.json";
import zhTW from "@/i18n/locales/zh-TW.json";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessWorkbench } from "@/components/access/AccessWorkbench";
import { accessApi } from "@/lib/api/access";
import { providersApi } from "@/lib/api";
import { proxyApi } from "@/lib/api/proxy";
import { open } from "@tauri-apps/plugin-dialog";

vi.mock("@/components/usage/UsageDashboard", () => ({
  UsageDashboard: () => <div>本地统计可用</div>,
}));
vi.mock("@/components/proxy/FailoverQueueManager", () => ({
  FailoverQueueManager: () => <div>主备队列</div>,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
const actions = {
  onAdd: vi.fn(),
  onProviders: vi.fn(),
};
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AccessWorkbench {...actions} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  i18n.addResourceBundle(
    "zh",
    "translation",
    { agentFiles: zh.agentFiles },
    true,
    true,
  );
  vi.restoreAllMocks();
  vi.spyOn(providersApi, "getAll").mockResolvedValue({
    p: { id: "p", name: "Custom API", settingsConfig: {}, category: "custom" },
  });
  vi.spyOn(proxyApi, "getProxyTakeoverStatus").mockResolvedValue({
    claude: false,
    codex: false,
    gemini: false,
    grokbuild: false,
    opencode: false,
    openclaw: false,
    hermes: false,
  });
  vi.spyOn(accessApi, "protection").mockResolvedValue(true);
  vi.spyOn(accessApi, "liteMode").mockResolvedValue(false);
  vi.spyOn(accessApi, "promptProtection").mockResolvedValue(false);
  vi.spyOn(accessApi, "providersOnlySync").mockResolvedValue(false);
  vi.spyOn(accessApi, "environmentTargets").mockResolvedValue([]);
  vi.spyOn(accessApi, "modelRoutes").mockResolvedValue([]);
  vi.spyOn(accessApi, "snapshots").mockResolvedValue([]);
});
describe("AccessWorkbench", () => {
  it("offers generic access without a HRouter login", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "添加供应商" }));
    expect(actions.onAdd).toHaveBeenCalledWith("general", "claude");
    fireEvent.click(screen.getByRole("button", { name: "添加 HRouter Key" }));
    expect(actions.onAdd).toHaveBeenCalledWith("hrouter", "claude");
    expect(
      screen.queryByRole("button", { name: "了解 / 登录 HRouter" }),
    ).toBeNull();
  });
  it("previews imports and submits only the selected nonexisting items", async () => {
    vi.mocked(open).mockResolvedValue("C:/migration/cc-switch.db");
    vi.spyOn(accessApi, "previewImport").mockResolvedValue([
      { id: "a", app: "claude", name: "A", exists: false },
      { id: "b", app: "codex", name: "B", exists: true },
    ]);
    const importer = vi
      .spyOn(accessApi, "importProviders")
      .mockResolvedValue(1);
    const switcher = vi.spyOn(providersApi, "switch");
    show();
    fireEvent.click(screen.getByRole("button", { name: "选择数据库并预览" }));
    await screen.findByText("已存在，跳过");
    expect(importer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "导入所选 1 项" }));
    await waitFor(() =>
      expect(importer).toHaveBeenCalledWith("C:/migration/cc-switch.db", [
        "claude:a",
      ]),
    );
    expect(switcher).not.toHaveBeenCalled();
  });
  it("requires explicit paid-test opt-in and a model", async () => {
    const user = userEvent.setup();
    const diagnose = vi.spyOn(accessApi, "diagnose").mockResolvedValue({
      testedAt: 1,
      model: "",
      protocol: "anthropic",
      models: ["test-model"],
      steps: [],
    });
    show();
    await user.click(screen.getByRole("tab", { name: "接入体检" }));
    await user.click(screen.getByRole("combobox", { name: "选择供应商" }));
    await user.click(await screen.findByRole("option", { name: "Custom API" }));
    await user.click(screen.getByRole("button", { name: "检测模型目录" }));
    await waitFor(() =>
      expect(diagnose).toHaveBeenCalledWith("claude", "p", "", false),
    );
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "开始完整体检" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "模型 ID" }));
    await user.click(await screen.findByRole("option", { name: "test-model" }));
    await user.click(screen.getByRole("button", { name: "开始完整体检" }));
    await waitFor(() =>
      expect(diagnose).toHaveBeenLastCalledWith(
        "claude",
        "p",
        "test-model",
        true,
      ),
    );
  });
  it("passes the preview fingerprint to the checked switch and shows conflicts", async () => {
    const user = userEvent.setup();
    vi.spyOn(accessApi, "preview").mockResolvedValue({
      fingerprint: "review-hash",
      protected: true,
      fields: ["/env/ANTHROPIC_API_KEY"],
      files: ["test/settings.json"],
    });
    const change = vi
      .spyOn(accessApi, "switch")
      .mockRejectedValue(new Error("配置在预览后发生变化，请重新预览。"));
    show();
    await user.click(screen.getByRole("tab", { name: "配置保护" }));
    await user.click(screen.getByRole("combobox", { name: "选择供应商" }));
    await user.click(await screen.findByRole("option", { name: "Custom API" }));
    await user.click(screen.getByRole("button", { name: "预览切换影响" }));
    await user.click(
      await screen.findByRole("button", { name: "确认切换并保存快照" }),
    );
    await waitFor(() =>
      expect(change).toHaveBeenCalledWith("claude", "p", "review-hash"),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "配置在预览后发生变化",
    );
  });
  it("does not gate local usage on account login", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("tab", { name: "费用与用量" }));
    expect(screen.getByText("本地统计可用")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "了解 / 登录 HRouter" }),
    ).not.toBeInTheDocument();
  });
  it("updates workbench labels when the UI language changes", async () => {
    show();
    try {
      for (const [language, resource, heading] of [
        ["en", en, "Connect your model service"],
        ["ja", ja, "モデルサービスに接続"],
        ["zh-TW", zhTW, "接入你的模型服務"],
      ] as const) {
        i18n.addResourceBundle(language, "translation", {
          accessWorkbench: resource.accessWorkbench,
        });
        await act(() => i18n.changeLanguage(language));
        expect(screen.getByRole("heading", { name: heading })).toBeVisible();
      }
    } finally {
      await act(() => i18n.changeLanguage("zh"));
    }
  });
});
it("routes all eleven agents through the same provider workspace and add action", async () => {
  show();
  const user = userEvent.setup();
  const codex = screen.getByRole("button", { name: /Codex/ });
  for (const [name, id] of [
    ["Pi Agent", "pi"],
    ["DeepSeek Harness", "deepseek-harness"],
    ["WorkBuddy", "workbuddy"],
  ] as const) {
    const card = screen.getByRole("button", { name: new RegExp(name) });
    expect(card.parentElement).toBe(codex.parentElement);
    await user.click(card);
    expect(screen.getByRole("tab", { name: "开放接入" })).toBeVisible();
    expect(
      screen.queryByRole("region", { name: `${name} 配置管理` }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "添加供应商" }));
    expect(actions.onAdd).toHaveBeenLastCalledWith("general", id);
    await user.click(screen.getByRole("button", { name: "添加 HRouter Key" }));
    expect(actions.onAdd).toHaveBeenLastCalledWith("hrouter", id);
    await user.click(screen.getByRole("button", { name: "配置中心" }));
    expect(actions.onProviders).toHaveBeenLastCalledWith(id);
  }
});
