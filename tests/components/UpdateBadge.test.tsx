import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateBadge } from "@/components/UpdateBadge";

const updateState = vi.hoisted(() => ({
  hasUpdate: false,
  updateInfo: null as null | {
    currentVersion: string;
    availableVersion: string;
    notes?: string;
    pubDate?: string;
  },
  isChecking: false,
  hasChecked: true,
  error: null as string | null,
  checkUpdate: vi.fn(async () => false),
  resetDismiss: vi.fn(),
}));

vi.mock("@/contexts/UpdateContext", () => ({
  useUpdate: () => updateState,
}));

vi.mock("@/lib/api", () => ({
  settingsApi: {
    isPortable: vi.fn(async () => false),
    checkUpdates: vi.fn(async () => undefined),
    installUpdateAndRestart: vi.fn(async () => true),
  },
}));

vi.mock("@/lib/updater", () => ({
  getCurrentVersion: vi.fn(async () => "0.2.1"),
}));

describe("UpdateBadge", () => {
  beforeEach(() => {
    localStorage.clear();
    updateState.hasUpdate = false;
    updateState.updateInfo = null;
    updateState.isChecking = false;
    updateState.hasChecked = true;
    updateState.error = null;
  });

  it("keeps the update entry visible when the app is up to date", () => {
    render(<UpdateBadge />);

    expect(
      screen.getByRole("button", { name: "settings.versionUpdate" }),
    ).toBeInTheDocument();
  });

  it("shows release notes in the update dialog", () => {
    updateState.hasUpdate = true;
    updateState.updateInfo = {
      currentVersion: "0.2.1",
      availableVersion: "0.3.0",
      notes: "新增模型广场价格同步\n优化版本更新体验",
      pubDate: "2026-08-27T00:00:00Z",
    };

    render(<UpdateBadge />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("v0.2.1")).toBeInTheDocument();
    expect(screen.getByText("v0.3.0")).toBeInTheDocument();
    expect(screen.getByText(/新增模型广场价格同步/)).toBeInTheDocument();
  });
});
