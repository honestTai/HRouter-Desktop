import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppSwitcher } from "@/components/AppSwitcher";
describe("AppSwitcher", () => {
  it("visibly marks exactly one Agent and leaves the selection controlled by the shell", () => {
    const onSwitch = vi.fn();
    const { rerender } = render(
      <AppSwitcher activeApp="codex" onSwitch={onSwitch} />,
    );
    const selected = screen.getByRole("button", { name: "Codex" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
      "ring-1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Gemini" }));
    expect(onSwitch).toHaveBeenCalledWith("gemini");
    rerender(<AppSwitcher activeApp="gemini" onSwitch={onSwitch} />);
    expect(screen.getByRole("button", { name: "Gemini" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-pressed") === "true"),
    ).toHaveLength(1);
    expect(selected).toHaveAttribute("aria-pressed", "false");
  });
});
