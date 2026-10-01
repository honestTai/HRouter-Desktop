import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DateTimeField,
  TemporalInput,
  validLocalDate,
} from "@/components/ui/date-time-field";

describe("React calendar fields", () => {
  it("validates actual local calendar dates", () => {
    expect(validLocalDate("2024-02-29")).toBe(true);
    expect(validLocalDate("2025-02-29")).toBe(false);
    expect(validLocalDate("2026-13-01")).toBe(false);
    expect(validLocalDate("2026-10-01")).toBe(true);
  });
  it("keeps incomplete keyboard input local and resets invalid values on blur", () => {
    const change = vi.fn();
    render(
      <TemporalInput kind="date" value="2026-10-01" onValueChange={change} />,
    );
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "2026-0" } });
    expect(field).toHaveValue("2026-0");
    expect(change).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(field).toHaveValue("2026-10-01");
    fireEvent.change(field, { target: { value: "2026-10-02" } });
    expect(change).toHaveBeenCalledWith("2026-10-02");
  });
  it("selects a day through shared React buttons, without a native date input", async () => {
    const change = vi.fn();
    const { container } = render(
      <DateTimeField
        value="2026-10-01T08:30"
        includeTime
        onValueChange={change}
        aria-label="Expires"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Expires" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "2026-10-02" }),
    );
    expect(change).toHaveBeenCalledWith("2026-10-02T08:30");
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
  });
});
