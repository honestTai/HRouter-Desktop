import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HRouterProviderForm } from "@/components/providers/forms/HRouterProviderForm";
import { fetchModelsForConfig } from "@/lib/api/model-fetch";
import type { Provider } from "@/types";

// Exercise form/config synchronization without CodeMirror's layout APIs,
// which jsdom does not implement.
vi.mock("@/components/JsonEditor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <div>
      <pre>{value}</pre>
      <textarea
        aria-label="测试 TOML 编辑器"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  ),
}));

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
    const preview = screen.getByLabelText("config.toml 完整配置编辑器");
    expect(preview).toHaveTextContent('model_provider = "hrouter"');
    expect(preview).toHaveTextContent("[model_providers.hrouter]");
    expect(preview).toHaveTextContent('base_url = "https://hrouter.net/v1"');
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
    const preview = screen.getByLabelText("config.toml 完整配置编辑器");
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

[custom_section]
keep_me = "preserved"
`,
      },
    });

    expect(screen.getByRole("radio", { name: "自定义" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("上下文窗口")).toHaveValue(500_000);
    expect(screen.getByLabelText("自动压缩阈值")).toHaveValue(420_000);
    expect(
      screen.getByLabelText("config.toml 完整配置编辑器"),
    ).toHaveTextContent('keep_me = "preserved"');
  });

  it("normalizes the provider id in a saved HRouter Codex config", () => {
    renderForm({
      id: "hrouter-codex",
      name: "HRouter",
      settingsConfig: {
        auth: { OPENAI_API_KEY: "sk-existing" },
        config: `model_provider = "legacy-route"

[model_providers.legacy-route]
base_url = "https://hrouter.net/v1"

[custom_section]
keep_me = "preserved"
`,
      },
    });

    const preview = screen.getByLabelText("config.toml 完整配置编辑器");
    expect(preview).toHaveTextContent('model_provider = "hrouter"');
    expect(preview).toHaveTextContent("[model_providers.hrouter]");
    expect(preview).toHaveTextContent('keep_me = "preserved"');
    expect(preview).not.toHaveTextContent("legacy-route");
  });
});

describe("HRouter editable model mappings", () => {
  beforeEach(() => {
    vi.mocked(fetchModelsForConfig).mockReset().mockResolvedValue([]);
  });

  const provider: Provider = {
    id: "custom-codex",
    name: "Custom",
    settingsConfig: {
      auth: { OPENAI_API_KEY: "test-key" },
      config: 'model = "custom-default"\nmodel_reasoning_effort = "high"\n',
      modelCatalog: {
        models: [
          {
            model: "custom-default",
            displayName: "GPT 6",
            contextWindow: 64000,
          },
        ],
      },
    },
  };

  it("shows mappings before model discovery and allows manual input", () => {
    renderForm();
    expect(screen.getByLabelText("默认模型")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "添加模型映射" }));
    fireEvent.change(screen.getByLabelText("实际模型 ID 1"), {
      target: { value: "team/alias" },
    });
    expect(screen.getByLabelText("实际模型 ID 1")).toHaveValue("team/alias");
  });

  it("saves custom IDs and display names even when discovery fails", async () => {
    vi.mocked(fetchModelsForConfig).mockRejectedValue(new Error("offline"));
    const submit = vi.fn();
    render(
      <HRouterProviderForm
        appId="codex"
        initialProvider={provider}
        onSubmit={submit}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("实际模型 ID 1")).toHaveValue(
      "custom-default",
    );
    fireEvent.change(screen.getByLabelText("显示名称 1"), {
      target: { value: "我的 GPT 6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加模型映射" }));
    fireEvent.change(screen.getByLabelText("实际模型 ID 2"), {
      target: { value: "custom-extra" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存 HRouter" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const saved = JSON.parse(submit.mock.calls[0][0].settingsConfig);
    expect(saved.modelCatalog.models).toEqual([
      expect.objectContaining({
        model: "custom-default",
        displayName: "我的 GPT 6",
        contextWindow: 64000,
      }),
      expect.objectContaining({ model: "custom-extra" }),
    ]);
  });

  it("refreshing models does not overwrite the default or edited mappings", async () => {
    const submit = vi.fn();
    render(
      <HRouterProviderForm
        appId="codex"
        initialProvider={provider}
        onSubmit={submit}
        onCancel={vi.fn()}
      />,
    );
    await waitFor(() => expect(fetchModelsForConfig).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("默认模型"), {
      target: { value: "manual-default" },
    });
    vi.mocked(fetchModelsForConfig).mockResolvedValue([
      { id: "gpt-5.5", ownedBy: "openai" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "识别 Key" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "已识别" })).toBeVisible(),
    );
    expect(screen.getByLabelText("默认模型")).toHaveValue("manual-default");
    expect(screen.getByLabelText("实际模型 ID 1")).toHaveValue(
      "custom-default",
    );
    fireEvent.click(screen.getByRole("button", { name: "保存 HRouter" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const saved = JSON.parse(submit.mock.calls[0][0].settingsConfig);
    expect(saved.config).toContain('model = "manual-default"');
    expect(
      saved.modelCatalog.models.map((row: { model: string }) => row.model),
    ).toEqual(["manual-default", "custom-default"]);
  });

  it("keeps the model in raw TOML, default input, and saved catalog consistent", async () => {
    const submit = vi.fn();
    render(
      <HRouterProviderForm
        appId="codex"
        initialProvider={provider}
        onSubmit={submit}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("测试 TOML 编辑器"), {
      target: {
        value: 'model = "raw-editor-alias"\nmodel_reasoning_effort = "low"\n',
      },
    });
    expect(screen.getByLabelText("默认模型")).toHaveValue("raw-editor-alias");
    fireEvent.click(screen.getByRole("button", { name: "保存 HRouter" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const saved = JSON.parse(submit.mock.calls[0][0].settingsConfig);
    expect(saved.config).toContain('model = "raw-editor-alias"');
    expect(saved.config).toContain('model_reasoning_effort = "low"');
    expect(saved.modelCatalog.models[0].model).toBe("raw-editor-alias");
  });

  it("rejects duplicate IDs and keeps an explicitly emptied catalog empty except for the default", async () => {
    const submit = vi.fn();
    render(
      <HRouterProviderForm
        appId="codex"
        initialProvider={provider}
        onSubmit={submit}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "添加模型映射" }));
    fireEvent.change(screen.getByLabelText("实际模型 ID 2"), {
      target: { value: " custom-default " },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存 HRouter" }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "删除模型映射 2" }));
    fireEvent.click(screen.getByRole("button", { name: "删除模型映射 1" }));
    fireEvent.click(screen.getByRole("button", { name: "保存 HRouter" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(
        submit.mock.calls[0][0].settingsConfig,
      ).modelCatalog.models.map((row: { model: string }) => row.model),
    ).toEqual(["custom-default"]);
  });

  it("rejects empty mapping rows rather than silently discarding them", async () => {
    const submit = vi.fn();
    render(
      <HRouterProviderForm
        appId="codex"
        initialProvider={provider}
        onSubmit={submit}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "添加模型映射" }));
    fireEvent.click(screen.getByRole("button", { name: "保存 HRouter" }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "删除模型映射 2" }));
    fireEvent.click(screen.getByRole("button", { name: "保存 HRouter" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });
});
