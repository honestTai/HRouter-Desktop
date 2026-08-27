import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HROUTER_HOME_URL, HRouterWebView } from "@/components/HRouterWebView";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
}));

vi.mock("@/lib/api", () => ({
  settingsApi: { openExternal: vi.fn() },
}));

describe("HRouterWebView", () => {
  it("embeds the hosted portal without copying its implementation", () => {
    render(<HRouterWebView />);

    const frame = screen.getByTitle("hrouterWeb.title");
    expect(frame).toHaveAttribute("src", HROUTER_HOME_URL);
    expect(screen.getByText("hrouter.net/home")).toBeInTheDocument();

    fireEvent.load(frame);
    expect(screen.queryByText("hrouterWeb.loading")).not.toBeInTheDocument();
  });

  it("opens the hosted portal in an external browser when requested", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<HRouterWebView />);

    fireEvent.click(
      screen.getByRole("button", { name: "hrouterWeb.openExternal" }),
    );

    expect(open).toHaveBeenCalledWith(
      HROUTER_HOME_URL,
      "_blank",
      "noopener,noreferrer",
    );
  });
});
