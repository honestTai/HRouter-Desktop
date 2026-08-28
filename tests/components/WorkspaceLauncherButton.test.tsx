import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceLauncherButton } from "@/components/terminal/WorkspaceLauncherButton";

const apiMocks = vi.hoisted(() => ({
  openWorkspace: vi.fn().mockResolvedValue("terminal-window"),
}));

vi.mock("@/lib/api", () => ({
  embeddedTerminalApi: {
    openWorkspace: apiMocks.openWorkspace,
  },
}));

describe("WorkspaceLauncherButton", () => {
  it("opens a standalone HRouter workspace from the application header", async () => {
    render(<WorkspaceLauncherButton />);

    fireEvent.click(screen.getByRole("button", { name: "工作台" }));

    await waitFor(() => {
      expect(apiMocks.openWorkspace).toHaveBeenCalledTimes(1);
      expect(apiMocks.openWorkspace).toHaveBeenCalledWith();
    });
  });
});
