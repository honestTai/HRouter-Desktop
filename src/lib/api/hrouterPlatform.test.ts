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

  it("forwards usage filters supported by the public frontend", async () => {
    saveHRouterSession({
      accessToken: "access-token",
      expiresAt: Date.now() + 3_600_000,
      user: {
        id: 10,
        username: "desktop-user",
        email: "user@example.com",
        balance: 0,
        concurrency: 1,
        status: "active",
        created_at: "2026-08-28T00:00:00Z",
      },
    });
    tauriMocks.invoke.mockResolvedValue({
      status: 200,
      data: {
        code: 0,
        data: { items: [], total: 0, page: 2, page_size: 50, pages: 0 },
      },
    });

    await hrouterAccountApi.usage(2, 50, {
      startDate: "2026-08-21",
      endDate: "2026-08-28",
      apiKeyId: 3,
      groupId: 8,
      model: "gpt-5.6-sol",
      requestType: "stream",
      billingType: 1,
      billingMode: "token",
    });

    expect(tauriMocks.invoke).toHaveBeenCalledWith(
      "hrouter_platform_request",
      expect.objectContaining({
        request: expect.objectContaining({
          path: "/usage",
          query: expect.objectContaining({
            page: "2",
            page_size: "50",
            start_date: "2026-08-21",
            end_date: "2026-08-28",
            api_key_id: "3",
            group_id: "8",
            model: "gpt-5.6-sol",
            request_type: "stream",
            billing_type: "1",
            billing_mode: "token",
          }),
        }),
      }),
    );
  });

  it("creates API keys in the selected group", async () => {
    saveHRouterSession({
      accessToken: "access-token",
      expiresAt: Date.now() + 3_600_000,
      user: {
        id: 11,
        username: "desktop-user",
        email: "user@example.com",
        balance: 0,
        concurrency: 1,
        status: "active",
        created_at: "2026-08-28T00:00:00Z",
      },
    });
    tauriMocks.invoke.mockResolvedValue({
      status: 200,
      data: {
        code: 0,
        data: { id: 1, name: "Codex", key: "sk-test", group_id: 8 },
      },
    });

    await hrouterAccountApi.createKey({ name: "Codex", group_id: 8 });

    expect(tauriMocks.invoke).toHaveBeenCalledWith(
      "hrouter_platform_request",
      expect.objectContaining({
        request: expect.objectContaining({
          method: "POST",
          path: "/keys",
          body: { name: "Codex", group_id: 8 },
        }),
      }),
    );
  });

  it("uses the public recharge APIs and flattens model groups", async () => {
    saveHRouterSession({
      accessToken: "access-token",
      expiresAt: Date.now() + 3_600_000,
      user: {
        id: 12,
        username: "desktop-user",
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
            groups: [
              {
                id: 8,
                name: "GPT Pro Fast - 0.45",
                rate_multiplier: 0.45,
                models: [
                  {
                    name: "gpt-5.6-sol",
                    pricing: { billing_mode: "token", input_price: 0.000004 },
                  },
                ],
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { code: 0, data: { message: "兑换成功" } },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { code: 0, data: { transferred: 10 } },
      });

    const models = await hrouterAccountApi.modelPlaza();
    await hrouterAccountApi.redeemCode("REDEEM-123");
    await hrouterAccountApi.transferAffiliate();

    expect(models).toEqual([
      expect.objectContaining({
        name: "gpt-5.6-sol",
        group_id: 8,
        group_name: "GPT Pro Fast - 0.45",
        rate_multiplier: 0.45,
      }),
    ]);
    expect(tauriMocks.invoke).toHaveBeenNthCalledWith(
      2,
      "hrouter_platform_request",
      expect.objectContaining({
        request: expect.objectContaining({
          method: "POST",
          path: "/redeem",
          body: { code: "REDEEM-123" },
        }),
      }),
    );
    expect(tauriMocks.invoke).toHaveBeenNthCalledWith(
      3,
      "hrouter_platform_request",
      expect.objectContaining({
        request: expect.objectContaining({
          method: "POST",
          path: "/user/aff/transfer",
        }),
      }),
    );
  });
});
