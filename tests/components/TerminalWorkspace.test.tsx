import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TerminalWorkspace } from "@/components/terminal/TerminalWorkspace";

const apiMocks = vi.hoisted(() => ({
  pickDirectory: vi.fn().mockResolvedValue("C:\\work\\hrouter-app"),
}));

vi.mock("@/lib/api", () => ({
  settingsApi: {
    pickDirectory: apiMocks.pickDirectory,
  },
}));

vi.mock("@/components/terminal/EmbeddedTerminalPane", () => ({
  EmbeddedTerminalPane: ({ tool, cwd }: { tool: string; cwd: string }) => (
    <div data-testid="terminal-pane" data-tool={tool} data-cwd={cwd} />
  ),
}));

describe("TerminalWorkspace", () => {
  it("chooses a directory and switches platform-level tools", async () => {
    render(<TerminalWorkspace />);

    expect(screen.getByText("HRouter Workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByTestId("terminal-pane")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择工作目录" }));

    await waitFor(() => {
      expect(apiMocks.pickDirectory).toHaveBeenCalledWith(undefined);
      expect(screen.getByTestId("terminal-pane")).toHaveAttribute(
        "data-tool",
        "terminal",
      );
    });
    expect(screen.getByTestId("terminal-pane")).toHaveAttribute(
      "data-cwd",
      "C:\\work\\hrouter-app",
    );
    expect(screen.getByText("hrouter-app")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Codex CLI" }));

    expect(screen.getByTestId("terminal-pane")).toHaveAttribute(
      "data-tool",
      "codex",
    );
    expect(screen.getByRole("button", { name: "Codex CLI" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
