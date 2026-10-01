import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APP_IDS, APP_ICON_MAP } from "@/config/appConfig";
import { AgentPicker } from "@/components/common/AgentPicker";
import { AppCountBar } from "@/components/common/AppCountBar";

describe("complete Agent inventory", () => {
  it("shows every Agent but never operates an unimplemented adapter", () => {
    const change = vi.fn();
    render(
      <AgentPicker
        value="codex"
        supported={["claude", "codex"]}
        onChange={change}
      />,
    );
    for (const app of APP_IDS)
      expect(
        screen.getByRole("button", { name: APP_ICON_MAP[app].label }),
      ).toBeVisible();
    const unsupported = screen.getByRole("button", { name: "WorkBuddy" });
    expect(unsupported).toBeDisabled();
    fireEvent.click(unsupported);
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Claude" }));
    expect(change).toHaveBeenCalledWith("claude");
  });

  it("shows all eleven Agents in the management cards without fake zero-count checkboxes", () => {
    const { container } = render(
      <AppCountBar
        totalLabel="Installed"
        counts={{ claude: 2 }}
        totalCount={2}
        appIds={["claude"]}
        showAllApps
        onToggleAll={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("label")).toHaveLength(APP_IDS.length);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByText("WorkBuddy", { selector: "span" })).toBeVisible();
    expect(
      screen.getByText("DeepSeek Harness", { selector: "span" }),
    ).toBeVisible();
  });
});
