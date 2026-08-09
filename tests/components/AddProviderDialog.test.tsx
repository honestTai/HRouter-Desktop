import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddProviderDialog } from "@/components/providers/AddProviderDialog";
import type { ProviderFormValues } from "@/components/providers/forms/ProviderForm";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

let mockFormValues: ProviderFormValues;

vi.mock("@/components/providers/forms/HRouterProviderForm", () => ({
  HRouterProviderForm: ({
    onSubmit,
  }: {
    onSubmit: (values: ProviderFormValues) => void;
  }) => (
    <form
      id="provider-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(mockFormValues);
      }}
    />
  ),
}));

describe("AddProviderDialog HRouter 专用入口", () => {
  beforeEach(() => {
    mockFormValues = {
      name: "HRouter",
      websiteUrl: "https://hrouter.net",
      notes: "Claude Code · HRouter Key 自动配置",
      settingsConfig: JSON.stringify({
        env: {
          ANTHROPIC_BASE_URL: "https://hrouter.net",
          ANTHROPIC_AUTH_TOKEN: "sk-test",
          ANTHROPIC_MODEL: "claude-sonnet",
        },
      }),
      icon: "hrouter",
      iconColor: "#10b981",
      presetCategory: "aggregator",
      meta: {
        providerType: "hrouter",
        usage_script: {
          enabled: true,
          language: "javascript",
          code: "({ request: {}, extractor: function () { return {}; } })",
          apiKey: "sk-test",
          baseUrl: "https://hrouter.net",
        },
      },
    };
  });

  it("提交 HRouter 配置并保留自动用量查询", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleOpenChange = vi.fn();

    render(
      <AddProviderDialog
        open
        onOpenChange={handleOpenChange}
        appId="claude"
        onSubmit={handleSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "添加 HRouter" }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1));
    const submitted = handleSubmit.mock.calls[0][0];
    expect(submitted.meta?.providerType).toBe("hrouter");
    expect(submitted.meta?.usage_script?.apiKey).toBe("sk-test");
    expect(submitted.settingsConfig.env.ANTHROPIC_MODEL).toBe("claude-sonnet");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("为 OpenCode 保留可添加多个配置所需的 providerKey", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    mockFormValues = {
      ...mockFormValues,
      providerKey: "hrouter-team-a",
    };

    render(
      <AddProviderDialog
        open
        onOpenChange={vi.fn()}
        appId="opencode"
        onSubmit={handleSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "添加 HRouter" }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1));
    expect(handleSubmit.mock.calls[0][0].providerKey).toBe("hrouter-team-a");
  });

  it("为 OpenClaw 传递预填模型目录与默认模型", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    mockFormValues = {
      ...mockFormValues,
      providerKey: "hrouter-openclaw",
      suggestedDefaults: {
        model: { primary: "hrouter-openclaw/gpt-5.6" },
        modelCatalog: {
          "hrouter-openclaw/gpt-5.6": { alias: "gpt-5.6" },
        },
      },
    };

    render(
      <AddProviderDialog
        open
        onOpenChange={vi.fn()}
        appId="openclaw"
        onSubmit={handleSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "添加 HRouter" }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1));
    expect(handleSubmit.mock.calls[0][0].suggestedDefaults).toEqual(
      mockFormValues.suggestedDefaults,
    );
  });
});
