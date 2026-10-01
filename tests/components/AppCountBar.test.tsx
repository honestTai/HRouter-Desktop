import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppCountBar } from "@/components/common/AppCountBar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { app?: string }) =>
      params?.app ? `${key}:${params.app}` : key,
  }),
}));

describe("AppCountBar", () => {
  it("keeps legacy counts non-interactive without a bulk callback", () => {
    render(
      <AppCountBar
        totalLabel="2 items"
        counts={{ claude: 1 }}
        appIds={["claude"]}
      />,
    );

    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("uses the whole badge to turn none or mixed into all and all into none", () => {
    const onToggleAll = vi.fn();
    const { rerender } = render(
      <AppCountBar
        totalLabel="2 items"
        totalCount={2}
        counts={{ claude: 1 }}
        appIds={["claude"]}
        onToggleAll={onToggleAll}
      />,
    );

    const mixed = screen.getByRole("checkbox", {
      name: "common.enableAllForApp:Claude",
    });
    expect(mixed).toHaveAttribute("aria-checked", "mixed");
    expect(mixed).toHaveAttribute("data-selection-state", "partial");
    fireEvent.click(mixed);
    expect(onToggleAll).toHaveBeenCalledWith("claude", true);

    rerender(
      <AppCountBar
        totalLabel="2 items"
        totalCount={2}
        counts={{ claude: 2 }}
        appIds={["claude"]}
        onToggleAll={onToggleAll}
      />,
    );

    const all = screen.getByRole("checkbox", {
      name: "common.disableAllForApp:Claude",
    });
    expect(all).toHaveAttribute("aria-checked", "true");
    expect(all).toHaveAttribute("data-selection-state", "all");
    fireEvent.click(all);
    expect(onToggleAll).toHaveBeenLastCalledWith("claude", false);
  });

  it("does not render a trailing selection box when no items are selected", () => {
    const onToggleAll = vi.fn();
    render(
      <AppCountBar
        totalLabel="2 items"
        totalCount={2}
        counts={{ claude: 0 }}
        appIds={["claude"]}
        onToggleAll={onToggleAll}
      />,
    );

    const none = screen.getByRole("checkbox", {
      name: "common.enableAllForApp:Claude",
    });
    expect(none).toHaveAttribute("aria-checked", "false");
    expect(none).toHaveAttribute("data-selection-state", "none");

    fireEvent.click(none);
    expect(onToggleAll).toHaveBeenCalledWith("claude", true);
  });

  it("disables bulk controls for an empty list or while any app is pending", () => {
    const onToggleAll = vi.fn();
    const { rerender } = render(
      <AppCountBar
        totalLabel="0 items"
        totalCount={0}
        counts={{ claude: 0 }}
        appIds={["claude"]}
        onToggleAll={onToggleAll}
      />,
    );

    expect(screen.getByRole("checkbox")).toBeDisabled();

    rerender(
      <AppCountBar
        totalLabel="2 items"
        totalCount={2}
        counts={{ claude: 1, codex: 1 }}
        appIds={["claude", "codex"]}
        pendingApp="claude"
        onToggleAll={onToggleAll}
      />,
    );

    for (const control of screen.getAllByRole("checkbox")) {
      expect(control).toBeDisabled();
      expect(control.closest("label")).not.toHaveClass("opacity-50");
    }

    const pendingControl = screen.getByRole("checkbox", {
      name: "common.enableAllForApp:Claude",
    });
    expect(pendingControl).toHaveAttribute("aria-busy", "true");
  });

  it("supports disabling bulk controls during another management write", () => {
    render(
      <AppCountBar
        totalLabel="2 items"
        totalCount={2}
        counts={{ claude: 1 }}
        appIds={["claude"]}
        onToggleAll={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("uses a responsive card grid instead of an overflowing inline strip", () => {
    render(
      <AppCountBar
        totalLabel="2 items"
        totalCount={2}
        counts={{ claude: 1 }}
        appIds={["claude"]}
        onToggleAll={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("checkbox").closest("label")?.parentElement,
    ).toHaveClass("grid", "grid-cols-2");
    expect(screen.getByText("2 items")).toBeVisible();
  });

  it("hides pointer focus rings while preserving keyboard focus styling", () => {
    render(
      <AppCountBar
        totalLabel="2 items"
        totalCount={2}
        counts={{ claude: 1 }}
        appIds={["claude"]}
        onToggleAll={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox")).toHaveClass(
      "focus-visible:outline-none",
      "focus-visible:ring-2",
    );
  });
});
