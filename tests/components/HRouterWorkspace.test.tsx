import { render, screen, fireEvent, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HRouterWorkspace } from "@/components/hrouter/HRouterWorkspace";
const state = vi.hoisted(() => ({ connected: true, session: null as any }));
vi.mock("@/hooks/useHRouterAccess", () => ({
  useHRouterAccess: () => ({ connected: state.connected, isLoading: false }),
}));
vi.mock("@/hooks/useHRouterSession", () => ({
  useHRouterSession: () => state.session,
}));
vi.mock("@/components/hrouter/HRouterAccountGate", () => ({
  HRouterAccountGate: ({ children }: any) =>
    state.session ? children : <div>sign-in-first</div>,
}));
vi.mock("@/components/hrouter/HRouterPageShell", () => ({
  HRouterLogout: () => <button>logout</button>,
}));
vi.mock("@/components/HRouterDashboard", () => ({
  HRouterDashboard: () => <div>account-dashboard</div>,
}));
vi.mock("@/components/hrouter/HRouterUsagePage", () => ({
  HRouterUsagePage: () => <div>account-records</div>,
}));
vi.mock("@/components/hrouter/HRouterApiKeysPage", () => ({
  HRouterApiKeysPage: () => <div>account-keys</div>,
}));
vi.mock("@/components/hrouter/HRouterProfilePage", () => ({
  HRouterProfilePage: () => <div>account-profile</div>,
}));
vi.mock("@/components/hrouter/HRouterBillingPage", () => ({
  HRouterBillingPage: () => <div>account-payment</div>,
}));
vi.mock("@/components/hrouter/HRouterOrdersPage", () => ({
  HRouterOrdersPage: () => <div>account-orders</div>,
}));
beforeEach(() => {
  state.connected = true;
  state.session = null;
});
describe("HRouter unified workspace", () => {
  it("never mounts private pages before login, then lands on dashboard plus records", () => {
    const { rerender } = render(<HRouterWorkspace />);
    expect(screen.getByText("sign-in-first")).toBeVisible();
    expect(screen.queryByText("account-dashboard")).toBeNull();
    state.session = { user: { id: 1 } };
    rerender(<HRouterWorkspace />);
    expect(screen.getByText("account-dashboard")).toBeVisible();
    expect(screen.getByText("account-records")).toBeVisible();
  });
  it("navigates keys, profile, payment and orders under one breadcrumb and resets after logout", () => {
    state.session = { user: { id: 1 } };
    const { rerender } = render(<HRouterWorkspace />);
    const nav = screen.getByRole("navigation", {
      name: "hrouterWorkspace.navigation",
    });
    fireEvent.click(
      within(nav).getByRole("button", { name: "navigation.apiKeys" }),
    );
    expect(screen.getByText("account-keys")).toBeVisible();
    fireEvent.click(
      within(nav).getByRole("button", { name: "hrouterWorkspace.profile" }),
    );
    expect(screen.getByText("account-profile")).toBeVisible();
    fireEvent.click(
      within(nav).getByRole("button", { name: "hrouterWorkspace.payment" }),
    );
    fireEvent.click(
      within(nav).getByRole("button", { name: "navigation.orders" }),
    );
    expect(screen.getByText("account-orders")).toBeVisible();
    const crumbs = screen.getByRole("navigation", {
      name: "hrouterWorkspace.breadcrumb",
    });
    expect(crumbs).toHaveTextContent("hrouterWorkspace.payment");
    fireEvent.click(
      within(crumbs).getByRole("button", { name: "hrouterWorkspace.home" }),
    );
    expect(screen.getByText("account-dashboard")).toBeVisible();
    state.session = null;
    rerender(<HRouterWorkspace />);
    state.session = { user: { id: 2 } };
    rerender(<HRouterWorkspace />);
    expect(screen.getByText("account-dashboard")).toBeVisible();
  });
  it("removes the whole account workspace when the configured key is removed", () => {
    state.session = { user: { id: 1 } };
    const { rerender } = render(<HRouterWorkspace />);
    state.connected = false;
    rerender(<HRouterWorkspace />);
    expect(screen.queryByTestId("hrouter-workspace")).toBeNull();
  });
});
