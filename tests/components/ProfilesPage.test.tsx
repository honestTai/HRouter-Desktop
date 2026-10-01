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
import { ProfilesPage } from "@/components/profiles/ProfilesPage";
import {
  profilesApi,
  type Profile,
  type ProfilesResponse,
} from "@/lib/api/profiles";
import { providersApi } from "@/lib/api";

let data: ProfilesResponse;
const slots = <T,>(value: T) => ({
  claude: value,
  "claude-desktop": value,
  codex: value,
});
const profile = (): Profile => ({
  id: "p1",
  name: "测试方案",
  payload: {
    providers: { ...slots(null), claude: "provider-a" },
    mcp: { ...slots(null), claude: [] },
    skills: slots(null),
    prompts: slots(null),
  },
});
function show() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfilesPage activeApp="claude" />
    </QueryClientProvider>,
  );
}
beforeEach(async () => {
  vi.restoreAllMocks();
  i18n.addResourceBundle("zh", "translation", zh, true, true);
  await i18n.changeLanguage("zh");
  data = {
    profiles: [profile()],
    currentIds: { claude: null, claudeDesktop: null, codex: null },
  };
  vi.spyOn(profilesApi, "list").mockImplementation(async () =>
    structuredClone(data),
  );
  vi.spyOn(providersApi, "getAll").mockResolvedValue({
    "provider-a": { id: "provider-a", name: "Alpha", settingsConfig: {} },
  });
  vi.spyOn(providersApi, "getCurrent").mockResolvedValue("provider-a");
  vi.spyOn(providersApi, "updateTrayMenu").mockResolvedValue(true);
});
describe("Access profiles using real query/mutation hooks", () => {
  it("requires delete confirmation; cancelling never invokes deletion", async () => {
    const remove = vi
      .spyOn(profilesApi, "delete")
      .mockImplementation(async (id) => {
        data.profiles = data.profiles.filter((p) => p.id !== id);
      });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "删除方案" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "取消" }),
    );
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "删除方案" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "确定" }),
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith("p1"));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "测试方案" }),
      ).not.toBeInTheDocument(),
    );
  });
  it("shows scope and side effects before applying, then persists partial failure warnings", async () => {
    const apply = vi
      .spyOn(profilesApi, "apply")
      .mockImplementation(async () => {
        data.currentIds.claude = "p1";
        return ["MCP unavailable"];
      });
    show();
    const button = await screen.findByRole("button", { name: "预览并应用" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/关闭此 Agent 的本地接管/),
    ).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "确定" }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith("p1", "claude"));
    expect(await screen.findByText("MCP unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("最近应用（不代表配置未被手动修改）"),
    ).toBeInTheDocument();
    // Same marker still allows reapplication after a manual config edit.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "预览并应用" })).toBeEnabled(),
    );
  });
  it("disables applying uncaptured scopes and snapshots the selected scope only", async () => {
    const update = vi.spyOn(profilesApi, "update").mockResolvedValue(profile());
    show();
    await screen.findByText("测试方案");
    fireEvent.click(screen.getByRole("button", { name: "Codex" }));
    expect(screen.getByRole("button", { name: "预览并应用" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "更新快照" }));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "确定" }),
    );
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("p1", {
        name: undefined,
        resnapshot: true,
        scope: "codex",
      }),
    );
  });
  it("creates, searches and renames a persisted profile", async () => {
    const create = vi
      .spyOn(profilesApi, "create")
      .mockImplementation(async (name) => {
        const p = { ...profile(), id: "p2", name };
        data.profiles.push(p);
        return p;
      });
    const update = vi
      .spyOn(profilesApi, "update")
      .mockImplementation(async (id, options) => {
        const p = data.profiles.find((p) => p.id === id)!;
        p.name = options.name!;
        return p;
      });
    show();
    await screen.findByText("测试方案");
    fireEvent.change(screen.getByLabelText("方案名称"), {
      target: { value: "  日常开发  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建方案" }));
    expect(
      await screen.findByRole("heading", { name: "日常开发" }),
    ).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith("日常开发", "claude");
    fireEvent.change(screen.getByLabelText("搜索方案"), {
      target: { value: "日常" },
    });
    expect(
      screen.queryByRole("heading", { name: "测试方案" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重命名" }));
    fireEvent.change(screen.getByLabelText("重命名"), {
      target: { value: "日常开发新版" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(
      await screen.findByRole("heading", { name: "日常开发新版" }),
    ).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith(
      "p2",
      expect.objectContaining({ name: "日常开发新版" }),
    );
  });
  it("surfaces read failures instead of claiming an empty list", async () => {
    vi.mocked(profilesApi.list).mockRejectedValue(
      new Error("database unavailable"),
    );
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "database unavailable",
    );
    expect(screen.getByRole("button", { name: "创建方案" })).toBeDisabled();
    expect(screen.queryByText(/暂无匹配方案/)).not.toBeInTheDocument();
  });
  it("keeps failed confirmations available for retry", async () => {
    vi.spyOn(profilesApi, "delete").mockRejectedValue(
      new Error("write failed"),
    );
    show();
    fireEvent.click(await screen.findByRole("button", { name: "删除方案" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "确定" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("write failed");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
