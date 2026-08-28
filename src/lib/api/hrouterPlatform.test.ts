import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/core", () => tauriMocks);

import {
  getHRouterSession,
  hrouterAccountApi,
  hrouterAuthApi,
  saveHRouterSession,
} from "./hrouterPlatform";

describe("HRouter platform API", () => {
  beforeEach(() => {
    localStorage.clear();
    tauriMocks.invoke.mockReset();
    tauriMocks.isTauri.mockReturnValue(true);
  });

  it("stores the account session returned by HRouter login", async () => {
    tauriMocks.invoke.mockResolvedValue({
      status: 200,
      data: {
        code: 0,
        data: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          user: {
            id: 7,
            username: "desktop-user",
            email: "user@example.com",
            balance: 12.5,
            concurrency: 2,
            status: "active",
            created_at: "2026-08-28T00:00:00Z",
          },
        },
      },
    });

    await hrouterAuthApi.login("user@example.com", "password123");

    expect(getHRouterSession()).toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: { id: 7 },
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith(
      "hrouter_platform_request",
      expect.objectContaining({
        request: expect.objectContaining({
          path: "/auth/login",
          body: { email: "user@example.com", password: "password123" },
          accessToken: undefined,
        }),
      }),
    );
  });

  it("refreshes an expired account token before loading usage", async () => {
    saveHRouterSession({
      accessToken: "expired-access",
      refreshToken: "refresh-token",
      expiresAt: Date.now() - 1,
      user: {
        id: 9,
        username: "user",
        email: "user@example.com",
        balance: 0,
        concurrency: 1,
        status: "active",
        created_at: "2026-08-28T00:00:00Z",
      },
    });
    tauriMocks.invoke
      .mockResolvedValueOnce({
        status: 200,
        data: {
          code: 0,
          data: {
            access_token: "fresh-access",
            refresh_token: "fresh-refresh",
            expires_in: 3600,
          },
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          code: 0,
          data: { items: [], total: 0, page: 1, page_size: 20, pages: 0 },
        },
      });

    await hrouterAccountApi.usage();

    expect(tauriMocks.invoke).toHaveBeenNthCalledWith(
      1,
      "hrouter_platform_request",
      expect.objectContaining({
        request: expect.objectContaining({
          path: "/auth/refresh",
          body: { refresh_token: "refresh-token" },
        }),
      }),
    );
    expect(tauriMocks.invoke).toHaveBeenNthCalledWith(
      2,
      "hrouter_platform_request",
      expect.objectContaining({
        request: expect.objectContaining({
          path: "/usage",
          accessToken: "fresh-access",
        }),
      }),
    );
  });

  it("never sends an account or provider key when requesting public settings", async () => {
    tauriMocks.invoke.mockResolvedValue({
      status: 200,
      data: { code: 0, data: { registration_enabled: true } },
    });

    await hrouterAuthApi.publicSettings();

    const request = tauriMocks.invoke.mock.calls[0][1].request;
    expect(request.accessToken).toBeUndefined();
    expect(JSON.stringify(request)).not.toMatch(/api.?key|provider.?key/i);
  });
});
