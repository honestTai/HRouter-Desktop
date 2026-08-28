import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HROUTER_HOME_URL, HRouterWebView } from "@/components/HRouterWebView";

describe("HRouterWebView", () => {
  it("embeds the hosted portal without copying its implementation", () => {
    render(<HRouterWebView />);

    const frame = screen.getByTitle("hrouterWeb.title");
    expect(frame).toHaveAttribute("src", HROUTER_HOME_URL);
    expect(screen.getByText("hrouter.net/home")).toBeInTheDocument();

    fireEvent.load(frame);
    expect(screen.queryByText("hrouterWeb.loading")).not.toBeInTheDocument();
  });

  it("keeps HRouter portal navigation inside the app", () => {
    render(<HRouterWebView />);

    expect(
      screen.queryByRole("button", { name: "hrouterWeb.openExternal" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTitle("hrouterWeb.title")).toHaveAttribute(
      "src",
      HROUTER_HOME_URL,
    );
  });
});
