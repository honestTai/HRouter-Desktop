import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "i18next";
import zh from "@/i18n/locales/zh.json";
import { AgentAccessCard } from "@/components/access/AgentAccessCard";
import { providersApi, type AppId } from "@/lib/api";
const select = vi.fn();
function show(app: AppId = "codex") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <AgentAccessCard
        app={app}
        name="Codex"
        icon="openai"
        selected
        onSelect={select}
      />
    </QueryClientProvider>,
  );
}
beforeEach(async () => {
  vi.restoreAllMocks();
  select.mockReset();
  i18n.addResourceBundle("zh", "translation", zh, true, true);
  await i18n.changeLanguage("zh");
  vi.spyOn(providersApi, "getAll").mockResolvedValue({
    p: {
      id: "p",
      name: "Local provider",
      settingsConfig: { config: 'model = "configured-model"' },
    },
  });
  vi.spyOn(providersApi, "getCurrent").mockResolvedValue("p");
});
describe("Agent access status cards", () => {
  it("shows the actual selected provider and configured model, and selects its Agent", async () => {
    show();
    expect(await screen.findByText("Local provider")).toBeInTheDocument();
    expect(await screen.findByText("configured-model")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button"));
    expect(select).toHaveBeenCalledOnce();
  });
  it("does not turn native read failure into an empty/healthy state", async () => {
    vi.mocked(providersApi.getAll).mockRejectedValue(new Error("offline"));
    show();
    expect(
      await screen.findByText(zh.agentAccess.unavailable),
    ).toBeInTheDocument();
    expect(screen.queryByText("Local provider")).not.toBeInTheDocument();
  });
  it("labels additive clients with a configuration count rather than a current provider", async () => {
    show("opencode");
    expect(await screen.findByText("1 个供应商配置")).toBeInTheDocument();
    expect(screen.queryByText("Local provider")).not.toBeInTheDocument();
  });
});
