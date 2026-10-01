import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
function Label() {
  return <span>{useTheme().theme}</span>;
}
it("keeps separate windows on the same theme without accepting invalid stored values", () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  localStorage.setItem("hrouter-theme", "light");
  render(
    <ThemeProvider>
      <Label />
    </ThemeProvider>,
  );
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", { key: "hrouter-theme", newValue: "dark" }),
    ),
  );
  expect(screen.getByText("dark")).toBeVisible();
  expect(document.documentElement).toHaveClass("dark");
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "hrouter-theme",
        newValue: "invalid",
      }),
    ),
  );
  expect(screen.getByText("dark")).toBeVisible();
});
