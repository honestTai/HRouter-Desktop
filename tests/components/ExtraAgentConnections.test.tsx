import i18n from "i18next";
import zh from "@/i18n/locales/zh.json";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { ExtraAgentConnections } from "@/components/agents/ExtraAgentConnections";
import { externalAgentsApi } from "@/lib/api/externalAgents";
import {
  deepseekSnippet,
  validConnection,
} from "@/components/agents/connectionTemplates";
vi.mock("@/lib/api/externalAgents", () => ({
  externalAgentsApi: { previewPi: vi.fn(), applyPi: vi.fn() },
}));
beforeEach(async () => {
  i18n.addResourceBundle("zh", "translation", zh, true, true);
  await i18n.changeLanguage("zh");
  vi.clearAllMocks();
  vi.mocked(externalAgentsApi.previewPi).mockResolvedValue({
    path: "/isolated/.pi/agent/models.json",
    fingerprint: "review-hash",
    existed: true,
    updatingProvider: false,
    modelCount: 1,
  });
  vi.mocked(externalAgentsApi.applyPi).mockResolvedValue({
    path: "/isolated/.pi/agent/models.json",
    backupPath: "/isolated/backup.json",
  });
});
async function setup(name: string) {
  const user = userEvent.setup();
  render(<ExtraAgentConnections />);
  await user.click(screen.getByRole("button", { name: new RegExp(name) }));
  await user.type(
    screen.getByLabelText("Base URL"),
    "https://relay.example/v1",
  );
  await user.type(screen.getByLabelText("模型 ID"), "test-model");
  return user;
}
describe("Additional client connection boundaries", () => {
  it("previews Pi before writing, then reports the real backup and next steps", async () => {
    const user = await setup("Pi Agent");
    await user.click(screen.getByRole("button", { name: "预览写入位置" }));
    await screen.findByText("即将修改");
    expect(externalAgentsApi.applyPi).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认备份并写入" }));
    await screen.findByText("配置已写入");
    expect(externalAgentsApi.applyPi).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialMode: "env",
        credential: "HROUTER_API_KEY",
      }),
      "review-hash",
    );
    expect(screen.getByText(/原始备份/)).toHaveTextContent(
      "/isolated/backup.json",
    );
  });
  it("invalidates preview when the endpoint or model changes", async () => {
    const user = await setup("Pi Agent");
    await user.click(screen.getByRole("button", { name: "预览写入位置" }));
    await screen.findByText("即将修改");
    await user.type(screen.getByLabelText("模型 ID"), "-changed");
    expect(
      screen.queryByRole("button", { name: "确认备份并写入" }),
    ).not.toBeInTheDocument();
    expect(externalAgentsApi.applyPi).not.toHaveBeenCalled();
  });
  it("surfaces native errors without reporting success", async () => {
    vi.mocked(externalAgentsApi.previewPi).mockRejectedValue(
      new Error("Invalid Pi JSON"),
    );
    const user = await setup("Pi Agent");
    await user.click(screen.getByRole("button", { name: "预览写入位置" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid Pi JSON",
    );
    expect(screen.queryByText("配置已写入")).not.toBeInTheDocument();
  });
  it("copies a DeepSeek plugin fragment without writing Harness configuration", async () => {
    const user = await setup("DeepSeek Harness");
    const clip = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(screen.getByRole("button", { name: "复制插件配置" }));
    expect(clip).toHaveBeenCalledWith(
      expect.stringContaining("@deepseek-ai/dsh-llm-pi-ai"),
    );
    expect(clip).toHaveBeenCalledWith(
      expect.stringContaining('apiKeyEnv: "HROUTER_API_KEY"'),
    );
    expect(externalAgentsApi.applyPi).not.toHaveBeenCalled();
  });
  it("keeps WorkBuddy as an explicit official-settings guide", async () => {
    const user = await setup("WorkBuddy");
    const clip = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    expect(screen.getByText(/打开 WorkBuddy/)).toBeVisible();
    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "复制服务地址" }));
    expect(clip).toHaveBeenCalledWith("https://relay.example/v1");
    expect(externalAgentsApi.previewPi).not.toHaveBeenCalled();
  });
  it("quotes YAML data and forbids credential commands/interpolation", () => {
    const input = {
      baseUrl: "https://relay.example/v1",
      model: "model: #value",
      api: "openai-completions" as const,
      credentialMode: "env" as const,
      credential: "HROUTER_API_KEY",
    };
    expect(deepseekSnippet(input)).toContain('id: "model: #value"');
    expect(
      validConnection({ ...input, baseUrl: "file:///tmp/key" }, "pi"),
    ).toBe(false);
    expect(
      validConnection(
        { ...input, credentialMode: "literal", credential: "!curl stolen" },
        "pi",
      ),
    ).toBe(false);
    expect(() =>
      deepseekSnippet({
        ...input,
        credentialMode: "literal",
        credential: "sk-secret",
      }),
    ).toThrow();
  });
});
