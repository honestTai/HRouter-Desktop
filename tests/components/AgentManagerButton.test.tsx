import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentManagerButton } from "@/components/AgentManagerButton";

const apiMocks = vi.hoisted(() => ({
  getToolVersions: vi.fn(),
  getCodexGuiStatus: vi.fn(),
  launchCodexGuiInstaller: vi.fn(),
  runToolLifecycleAction: vi.fn(),
  probeToolInstallations: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  settingsApi: apiMocks,
}));

vi.mock("@/components/ProviderIcon", () => ({
  ProviderIcon: ({ name }: { name: string }) => <span>{name}</span>,
}));

describe("AgentManagerButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getToolVersions.mockImplementation(async ([name]: string[]) => [
      {
        name,
        version: "1.0.0",
        latest_version: "1.0.0",
        error: null,
        installed_but_broken: false,
        env_type: "windows",
        wsl_distro: null,
      },
    ]);
    apiMocks.getCodexGuiStatus.mockResolvedValue({
      platform: "windows",
      arch: "x64",
      supported: true,
      installed: true,
      version: "26.820.7780.0",
    });
    apiMocks.launchCodexGuiInstaller.mockResolvedValue(true);
    apiMocks.runToolLifecycleAction.mockResolvedValue(undefined);
    apiMocks.probeToolInstallations.mockResolvedValue([]);
  });

  it("checks every CLI and does not query or display GUI installers", async () => {
    render(<AgentManagerButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings.agentInstallUpdate" }),
    );
    await waitFor(() =>
      expect(apiMocks.getToolVersions).toHaveBeenCalledTimes(10),
    );
    for (const name of [
      "claude",
      "codex",
      "gemini",
      "grok",
      "opencode",
      "openclaw",
      "hermes",
      "pi",
      "dsh",
      "codebuddy",
    ]) {
      expect(apiMocks.getToolVersions).toHaveBeenCalledWith([name]);
    }
    expect(apiMocks.getCodexGuiStatus).not.toHaveBeenCalled();
    expect(screen.queryByText("Codex GUI")).not.toBeInTheDocument();
    expect(
      screen.queryByText("settings.desktopAgents"),
    ).not.toBeInTheDocument();
    expect(apiMocks.launchCodexGuiInstaller).not.toHaveBeenCalled();
  });
  it("installs a newly supported CLI through the real lifecycle action API", async () => {
    apiMocks.getToolVersions.mockImplementation(async ([name]: string[]) => [
      {
        name,
        version: name === "pi" ? null : "1.0.0",
        latest_version: "1.0.0",
        error: null,
        env_type: "macos",
        installed_but_broken: false,
      },
    ]);
    render(<AgentManagerButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings.agentInstallUpdate" }),
    );
    const install = await screen.findByRole("button", {
      name: "settings.toolInstall",
    });
    fireEvent.click(install);
    await waitFor(() =>
      expect(apiMocks.runToolLifecycleAction).toHaveBeenCalledWith(
        ["pi"],
        "install",
      ),
    );
    expect(apiMocks.launchCodexGuiInstaller).not.toHaveBeenCalled();
  });
});
