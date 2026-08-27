import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HelpCenterButton } from "@/components/HelpCenterButton";

const state = vi.hoisted(() => ({
  settings: {
    language: "zh",
    firstRunNoticeConfirmed: true,
  },
  save: vi.fn(async () => undefined),
}));

vi.mock("@/lib/query", () => ({
  useSettingsQuery: () => ({ data: state.settings }),
}));

vi.mock("@/lib/api", () => ({
  settingsApi: {
    save: state.save,
  },
}));

function renderHelpCenter() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HelpCenterButton />
    </QueryClientProvider>,
  );
}

describe("HelpCenterButton", () => {
  beforeEach(() => {
    state.settings.firstRunNoticeConfirmed = true;
  });

  it("opens the feature FAQ from the persistent header entry", () => {
    renderHelpCenter();

    fireEvent.click(screen.getByRole("button", { name: "faq.button" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("faq.quickStart")).toBeInTheDocument();
    expect(screen.getByText("faq.providersTitle")).toBeInTheDocument();
    expect(screen.getByText("faq.agentsTitle")).toBeInTheDocument();
    expect(screen.getByText("faq.supportTitle")).toBeInTheDocument();
  });

  it("opens automatically once and persists first-run acknowledgement", async () => {
    state.settings.firstRunNoticeConfirmed = false;
    renderHelpCenter();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "faq.start" }));

    await waitFor(() => {
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({ firstRunNoticeConfirmed: true }),
      );
    });
  });
});
