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

  it("loads CLI and GUI statuses and launches the GUI installer", async () => {
    render(<AgentManagerButton />);

    fireEvent.click(
      screen.getByRole("button", { name: "settings.agentInstallUpdate" }),
    );

    await waitFor(() => {
      expect(apiMocks.getToolVersions).toHaveBeenCalledTimes(7);
      expect(apiMocks.getCodexGuiStatus).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("settings.commandLineAgents")).toBeInTheDocument();
    expect(screen.getByText("settings.desktopAgents")).toBeInTheDocument();
    expect(screen.getAllByText("Codex GUI")).toHaveLength(2);
    expect(screen.getByText("settings.codexGuiInstalled")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "settings.toolUpdate" }),
    );

    await waitFor(() => {
      expect(apiMocks.launchCodexGuiInstaller).toHaveBeenCalledTimes(1);
    });
    expect(apiMocks.runToolLifecycleAction).not.toHaveBeenCalled();
  });

  it("shows and checks the desktop app for the current macOS platform", async () => {
    apiMocks.getCodexGuiStatus.mockResolvedValue({
      platform: "macos",
      arch: "arm64",
      supported: true,
      installed: false,
      version: null,
    });

    render(<AgentManagerButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings.agentInstallUpdate" }),
    );

    expect(await screen.findByText("macOS")).toBeInTheDocument();
    expect(
      screen.getByText("settings.codexGuiNotInstalled"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "settings.codexGuiDownload" }),
    );

    await waitFor(() => {
      expect(apiMocks.launchCodexGuiInstaller).toHaveBeenCalledTimes(1);
    });
  });
});
