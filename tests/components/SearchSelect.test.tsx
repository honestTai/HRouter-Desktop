import i18n from "i18next";
import zh from "@/i18n/locales/zh.json";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { SearchSelect } from "@/components/ui/search-select";
const options = [
  { value: "", label: "Select provider" },
  { value: "alpha", label: "Alpha relay", description: "Direct API" },
  { value: "beta", label: "Beta relay" },
  { value: "disabled", label: "Unavailable", disabled: true },
];
function Example({
  custom = false,
  disabled = false,
}: {
  custom?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <SearchSelect
      aria-label="Provider"
      options={options}
      value={value}
      onValueChange={setValue}
      allowCustomValue={custom}
      disabled={disabled}
    />
  );
}
describe("SearchSelect using Radix and cmdk", () => {
  it("filters, selects, closes and restores focus", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("combobox", { name: "Provider" });
    await user.click(trigger);
    await user.type(screen.getByPlaceholderText("搜索选项…"), "beta");
    expect(
      screen.queryByRole("option", { name: /Alpha/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Beta relay" }));
    expect(trigger).toHaveTextContent("Beta relay");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("supports keyboard open, search, Enter and Escape", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("combobox", { name: "Provider" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const search = screen.getByPlaceholderText("搜索选项…");
    await user.type(search, "alpha");
    await user.keyboard("{Enter}");
    expect(trigger).toHaveTextContent("Alpha relay");
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
  it("offers an empty value without confusing it with a missing selection", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("combobox", { name: "Provider" }));
    await user.click(screen.getByRole("option", { name: "Beta relay" }));
    await user.click(screen.getByRole("combobox", { name: "Provider" }));
    await user.click(screen.getByRole("option", { name: "Select provider" }));
    expect(
      screen.getByRole("combobox", { name: "Provider" }),
    ).toHaveTextContent("Select provider");
  });
  it("reports no matches and cannot select a disabled entry", async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchSelect
        aria-label="Provider"
        options={options}
        value=""
        onValueChange={change}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Provider" }));
    expect(screen.getByRole("option", { name: "Unavailable" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.type(screen.getByPlaceholderText("搜索选项…"), "nothing");
    expect(screen.getByText("没有匹配的选项")).toBeVisible();
    expect(change).not.toHaveBeenCalled();
  });
  it("lets model IDs be entered explicitly without a native datalist", async () => {
    const user = userEvent.setup();
    render(<Example custom />);
    await user.click(screen.getByRole("combobox", { name: "Provider" }));
    await user.type(screen.getByPlaceholderText("搜索选项…"), "private-model");
    await user.click(
      screen.getByRole("option", { name: "使用“private-model”" }),
    );
    expect(
      screen.getByRole("combobox", { name: "Provider" }),
    ).toHaveTextContent("private-model");
  });
  it("does not open while disabled", async () => {
    const user = userEvent.setup();
    render(<Example disabled />);
    const trigger = screen.getByRole("combobox", { name: "Provider" });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

beforeEach(async () => {
  i18n.addResourceBundle("zh", "translation", zh, true, true);
  await i18n.changeLanguage("zh");
});
