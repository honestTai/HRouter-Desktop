import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsPage } from "@/components/usage/AnalyticsPage";
import { MagpieTopNav } from "@/components/layout/MagpieTopNav";

vi.mock("@/components/usage/UsageDashboard", () => ({
  UsageDashboard: ({ mode = "full", initialApp }: any) => (
    <div data-testid="local-dashboard" data-agent={initialApp}>
      local-{mode}
    </div>
  ),
}));
vi.mock("@/components/usage/LocalUsageSync", () => ({
  LocalUsageSync: () => <div>local-sync</div>,
}));
describe("usage workspace", () => {
  it("does not render local-data / no-login narration or a single-source tab bar", () => {
    render(<AnalyticsPage />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText("localAnalytics.localNote")).toBeNull();
    expect(screen.queryByText("localAnalytics.cloudNote")).toBeNull();
  });
  it("passes the shell Agent to local data when switching agents", () => {
    const { rerender } = render(<AnalyticsPage activeApp="gemini" />);
    expect(screen.getByTestId("local-dashboard")).toHaveAttribute(
      "data-agent",
      "gemini",
    );
    rerender(<AnalyticsPage activeApp="pi" />);
    expect(screen.getByTestId("local-dashboard")).toHaveAttribute(
      "data-agent",
      "pi",
    );
  });
  it("shows a real local overview with no key or login", () => {
    render(<AnalyticsPage />);
    expect(screen.getByText("local-full")).toBeVisible();
    expect(screen.getByText("local-sync")).toBeVisible();
    expect(
      screen.queryByRole("tab", { name: "localAnalytics.cloud" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "localAnalytics.login" }),
    ).toBeNull();
  });
  it("keeps overview and records in a single full local view", () => {
    render(<AnalyticsPage />);
    expect(screen.getByText("local-full")).toBeVisible();
  });
  it("has no cloud source or account login controls", () => {
    render(<AnalyticsPage />);
    expect(screen.getByText("local-full")).toBeVisible();
    expect(screen.queryByText("cloud-records")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "localAnalytics.login" }),
    ).toBeNull();
  });
  it("does not expose the retired HRouter platform in navigation", () => {
    const navigate = vi.fn();
    render(
      <MagpieTopNav
        activeApp="codex"
        currentView="usage"
        onHermesWebUI={vi.fn()}
        onNavigate={navigate}
        onSettings={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "HRouter" })).toBeNull();
    expect(screen.getByRole("button", { name: "skills.manage" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "navigation.billing" }),
    ).toBeNull();
  });
  it("does not show account controls for a retained login without a key", () => {
    render(
      <MagpieTopNav
        activeApp="codex"
        currentView="usage"
        onHermesWebUI={vi.fn()}
        onNavigate={vi.fn()}
        onSettings={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "test-account" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "workspaceUi.analyticsTitle" }),
    ).toBeVisible();
  });
});
