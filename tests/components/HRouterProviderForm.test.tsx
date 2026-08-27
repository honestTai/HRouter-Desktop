import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HRouterProviderForm } from "@/components/providers/forms/HRouterProviderForm";
import type { Provider } from "@/types";

vi.mock("@/lib/query/queries", () => ({
  useProvidersQuery: () => ({
    data: { providers: {}, currentProviderId: "" },
  }),
}));

vi.mock("@/lib/api/model-fetch", () => ({
  fetchModelsForConfig: vi.fn().mockResolvedValue([]),
  showFetchModelsError: vi.fn(),
}));

const renderForm = (initialProvider?: Provider) =>
  render(
    <HRouterProviderForm
      appId="codex"
      initialProvider={initialProvider}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      showButtons={false}
    />,
  );

describe("HRouterProviderForm Codex context settings", () => {
  it("uses the 272K window and 90% compact threshold for a new provider", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "官方 272K" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const preview = screen.getByLabelText("config.toml 配置预览");
    expect(preview).toHaveTextContent("model_context_window = 272000");
    expect(preview).toHaveTextContent(
      "model_auto_compact_token_limit = 244800",
    );

    fireEvent.click(screen.getByRole("radio", { name: "自定义" }));
    const contextWindowInput = screen.getByLabelText("上下文窗口");
    const autoCompactInput = screen.getByLabelText("自动压缩阈值");
    expect(contextWindowInput).toHaveValue(272_000);
    expect(autoCompactInput).toHaveValue(244_800);

    fireEvent.change(contextWindowInput, { target: { value: "320000" } });
    fireEvent.change(autoCompactInput, { target: { value: "280000" } });

    expect(contextWindowInput).toHaveValue(320_000);
    expect(autoCompactInput).toHaveValue(280_000);
  });

  it("switches to the official 1M preset and updates config.toml", () => {
    renderForm();

    fireEvent.click(screen.getByRole("radio", { name: "官方 1M" }));

    expect(screen.getByRole("radio", { name: "官方 1M" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const preview = screen.getByLabelText("config.toml 配置预览");
    expect(preview).toHaveTextContent("model_context_window = 1000000");
    expect(preview).toHaveTextContent(
      "model_auto_compact_token_limit = 900000",
    );
  });

  it("shows the saved context settings when editing a provider", () => {
    renderForm({
      id: "hrouter-codex",
      name: "HRouter",
      settingsConfig: {
        auth: { OPENAI_API_KEY: "sk-existing" },
        config: `model = "gpt-5.6-sol"
model_context_window = 500000
model_auto_compact_token_limit = 420000
`,
      },
    });

    expect(screen.getByRole("radio", { name: "自定义" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("上下文窗口")).toHaveValue(500_000);
    expect(screen.getByLabelText("自动压缩阈值")).toHaveValue(420_000);
  });
});
