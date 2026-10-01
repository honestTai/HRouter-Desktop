import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsPage } from "@/components/usage/AnalyticsPage";
import { MagpieTopNav } from "@/components/layout/MagpieTopNav";

const access = vi.hoisted(() => ({
  connected: false,
  cloudEnabled: false,
  session: null as any,
}));
vi.mock("@/hooks/useHRouterAccess", () => ({ useHRouterAccess: () => access }));
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
vi.mock("@/components/HRouterDashboard", () => ({
  HRouterDashboard: () => <div>cloud-overview</div>,
}));
vi.mock("@/components/hrouter/HRouterUsagePage", () => ({
  HRouterUsagePage: () => <div>cloud-records</div>,
}));

const props = {
  source: "local" as const,
  onSourceChange: vi.fn(),
  onLogin: vi.fn(),
};
beforeEach(() =>
  Object.assign(access, {
    connected: false,
    cloudEnabled: false,
    session: null,
  }),
);
describe("usage workspace", () => {
  it("does not render local-data / no-login narration or a single-source tab bar", () => {
    render(<AnalyticsPage {...props} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText("localAnalytics.localNote")).toBeNull();
    expect(screen.queryByText("localAnalytics.cloudNote")).toBeNull();
  });
  it("passes the shell Agent to local data without filtering the account-wide cloud view", () => {
    const { rerender } = render(
      <AnalyticsPage {...props} activeApp="gemini" />,
    );
    expect(screen.getByTestId("local-dashboard")).toHaveAttribute(
      "data-agent",
      "gemini",
    );
    rerender(<AnalyticsPage {...props} activeApp="pi" />);
    expect(screen.getByTestId("local-dashboard")).toHaveAttribute(
      "data-agent",
      "pi",
    );
  });
  it("shows a real local overview with no key or login", () => {
    render(<AnalyticsPage {...props} />);
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
    render(<AnalyticsPage {...props} />);
    expect(screen.getByText("local-full")).toBeVisible();
  });
  it("keeps account queries out of Agent analytics even when a key and session exist", () => {
    Object.assign(access, { connected: true, cloudEnabled: true });
    render(<AnalyticsPage {...props} source="hrouter" />);
    expect(screen.getByText("local-full")).toBeVisible();
    expect(screen.queryByText("cloud-records")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "localAnalytics.login" }),
    ).toBeNull();
  });
  it("places a single HRouter entry immediately after Skills when a key is configured", () => {
    access.connected = true;
    const navigate = vi.fn();
    render(
      <MagpieTopNav
        activeApp="codex"
        currentView="usage"
        onHermesWebUI={vi.fn()}
        onNavigate={navigate}
        onSettings={vi.fn()}
        onProfile={vi.fn()}
        onFrontend={vi.fn()}
      />,
    );
    const entry = screen.getByRole("button", { name: "HRouter" });
    expect(entry.previousElementSibling).toHaveTextContent("skills.manage");
    entry.click();
    expect(navigate).toHaveBeenCalledWith("hrouter");
    expect(
      screen.queryByRole("button", { name: "navigation.billing" }),
    ).toBeNull();
  });
  it("does not show account controls for a retained login without a key", () => {
    access.session = { user: { id: 1, username: "test-account" } };
    render(
      <MagpieTopNav
        activeApp="codex"
        currentView="usage"
        onHermesWebUI={vi.fn()}
        onNavigate={vi.fn()}
        onSettings={vi.fn()}
        onProfile={vi.fn()}
        onFrontend={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "test-account" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "workspaceUi.analyticsTitle" }),
    ).toBeVisible();
  });
});
