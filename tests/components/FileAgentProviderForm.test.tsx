import i18n from "i18next";
import zh from "@/i18n/locales/zh.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddProviderDialog } from "@/components/providers/AddProviderDialog";
import { ProviderForm } from "@/components/providers/forms/ProviderForm";
import { ProviderIcon } from "@/components/ProviderIcon";
import { buildHRouterSettingsConfig } from "@/lib/hrouter";
import type { FileAgentId } from "@/config/fileAgents";
import { FILE_AGENT_ICONS } from "@/config/fileAgents";

beforeEach(async () => {
  i18n.addResourceBundle("zh", "translation", zh, true, true);
  await i18n.changeLanguage("zh");
});
function show(element: React.ReactElement) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {element}
    </QueryClientProvider>,
  );
}
describe("File agents use the standard provider forms", () => {
  it.each(["pi", "deepseek-harness", "workbuddy"] as const)(
    "%s submits a provider through the standard add panel",
    async (appId) => {
      const submit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      show(
        <AddProviderDialog
          open
          appId={appId}
          onOpenChange={vi.fn()}
          onSubmit={submit}
        />,
      );
      await user.type(screen.getByLabelText(/供应商名称/), "My relay");
      await user.type(
        screen.getByLabelText("Base URL"),
        "https://relay.example/v1",
      );
      await user.type(screen.getByLabelText("API Key"), "test-key");
      await user.type(screen.getByLabelText("模型 ID"), "test-model");
      await user.click(screen.getByRole("button", { name: "添加供应商" }));
      await waitFor(() =>
        expect(submit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "My relay",
            icon: FILE_AGENT_ICONS[appId],
            settingsConfig: expect.objectContaining({
              baseUrl: "https://relay.example/v1",
              model: "test-model",
              credential: "test-key",
              credentialMode: "literal",
            }),
          }),
        ),
      );
      expect(
        screen.queryByText("更多 Agent · 轻量接入"),
      ).not.toBeInTheDocument();
    },
  );
  it.each(["pi", "deepseek-harness", "workbuddy"] as const)(
    "%s edits the same saved provider fields",
    async (appId) => {
      const submit = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      show(
        <ProviderForm
          appId={appId}
          providerId="saved"
          submitLabel="保存"
          onSubmit={submit}
          onCancel={vi.fn()}
          initialData={{
            name: "Saved relay",
            settingsConfig: {
              baseUrl: "https://old.example/v1",
              model: "old-model",
              api: "openai-completions",
              credentialMode: "literal",
              credential: "test-secret",
              keepMe: true,
            },
          }}
        />,
      );
      expect(screen.getByLabelText("API Key")).toHaveValue("test-secret");
      await user.clear(screen.getByLabelText("Base URL"));
      await user.type(
        screen.getByLabelText("Base URL"),
        "https://new.example/v1",
      );
      await user.click(screen.getByRole("button", { name: "保存" }));
      await waitFor(() => expect(submit).toHaveBeenCalled());
      const payload = submit.mock.calls[0][0];
      expect(JSON.parse(payload.settingsConfig)).toMatchObject({
        baseUrl: "https://new.example/v1",
        credential: "test-secret",
        keepMe: true,
      });
    },
  );
  it("rejects invalid connections in the shared form", async () => {
    const submit = vi.fn();
    const user = userEvent.setup();
    show(
      <ProviderForm
        appId="pi"
        submitLabel="保存"
        onSubmit={submit}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "有效的服务地址",
    );
    expect(submit).not.toHaveBeenCalled();
  });
  it.each(["pi", "deepseek-harness", "workbuddy"] as const)(
    "%s also supports the normal HRouter quick-connect config",
    (id) => {
      const config = buildHRouterSettingsConfig(
        id,
        "test-key",
        { primary: "model", haiku: "", sonnet: "", opus: "" },
        [],
      );
      expect(config).toMatchObject({
        model: "model",
        credentialMode: "literal",
        credential: "test-key",
        api: "openai-completions",
      });
    },
  );
  it.each(["pi", "deepseek-harness", "workbuddy"] as FileAgentId[])(
    "%s renders an actual logo rather than a letter fallback",
    (id) => {
      const { container } = render(
        <ProviderIcon icon={FILE_AGENT_ICONS[id]} name={id} />,
      );
      expect(container.querySelector("svg, img")).not.toBeNull();
      expect(container.textContent).not.toBe("DS");
    },
  );
});
