import { beforeEach, describe, expect, it, vi } from "vitest";

const updaterMocks = vi.hoisted(() => ({
  check: vi.fn(),
  getVersion: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: updaterMocks.getVersion,
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: updaterMocks.check,
}));

import { checkForUpdate } from "./updater";

describe("checkForUpdate", () => {
  beforeEach(() => {
    updaterMocks.check.mockReset();
    updaterMocks.getVersion.mockReset();
    updaterMocks.getVersion.mockResolvedValue("0.2.4");
  });

  it("maps Tauri's update body to the release notes shown by HRouter", async () => {
    updaterMocks.check.mockResolvedValue({
      version: "0.2.5",
      body: "新增 HRouter 工作台更新日志",
      date: "2026-08-29T00:00:00Z",
    });

    await expect(checkForUpdate()).resolves.toEqual({
      status: "available",
      info: {
        currentVersion: "0.2.4",
        availableVersion: "0.2.5",
        notes: "新增 HRouter 工作台更新日志",
        pubDate: "2026-08-29T00:00:00Z",
      },
    });
  });

  it("keeps compatibility with update objects that expose notes directly", async () => {
    updaterMocks.check.mockResolvedValue({
      version: "0.2.5",
      notes: "兼容旧版更新字段",
    });

    const result = await checkForUpdate();

    expect(result).toMatchObject({
      status: "available",
      info: { notes: "兼容旧版更新字段" },
    });
  });
});
