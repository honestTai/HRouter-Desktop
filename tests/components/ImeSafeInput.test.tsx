import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImeSafeInput } from "@/components/ui/ime-safe-input";

describe("ImeSafeInput", () => {
  it("keeps composition changes local until composition ends", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <ImeSafeInput value="" onValueChange={onValueChange} />,
    );
    const input = screen.getByRole("textbox");

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "mimo" } });
    rerender(<ImeSafeInput value="" onValueChange={onValueChange} />);

    expect(input).toHaveValue("mimo");
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input, { data: "mimo" });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("mimo");

    fireEvent.change(input, { target: { value: "mimo" } });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("normalizes only the committed composition value", () => {
    const onValueChange = vi.fn();
    render(
      <ImeSafeInput
        value=""
        onValueChange={onValueChange}
        normalize={(value) => value.toLowerCase().replace(/[^a-z0-9-]/g, "")}
      />,
    );
    const input = screen.getByRole("textbox");

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "Mi好-1" } });
    expect(input).toHaveValue("Mi好-1");

    fireEvent.compositionEnd(input, { data: "Mi好-1" });
    expect(input).toHaveValue("mi-1");
    expect(onValueChange).toHaveBeenCalledWith("mi-1");
  });

  it("force-commits an unfinished composition on blur", () => {
    const onValueChange = vi.fn();
    render(<ImeSafeInput value="" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox");

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "未完成" } });
    fireEvent.blur(input);

    expect(onValueChange).toHaveBeenCalledWith("未完成");
    fireEvent.compositionEnd(input, {
      data: "未完成",
      target: { value: "未完成" },
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("reconciles an idle draft on blur", () => {
    const onValueChange = vi.fn();
    const canonicalValue = '{"enabled":true}';
    const { rerender } = render(
      <ImeSafeInput value={canonicalValue} onValueChange={onValueChange} />,
    );
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: '{ "enabled": true }' } });
    rerender(
      <ImeSafeInput value={canonicalValue} onValueChange={onValueChange} />,
    );
    fireEvent.blur(input);

    expect(input).toHaveValue(canonicalValue);
  });
});
