import { describe, expect, it } from "vitest";
import { parseHRouterAnnouncements } from "./hrouterAnnouncements";

describe("parseHRouterAnnouncements", () => {
  it("parses the wrapped HRouter API response", () => {
    expect(
      parseHRouterAnnouncements({
        code: 0,
        data: [
          {
            id: 18,
            title: "服务升级",
            content: "升级期间不影响现有请求。",
            type: "maintenance",
            created_at: "2026-08-28T10:00:00Z",
          },
        ],
      }),
    ).toEqual([
      {
        id: "18",
        title: "服务升级",
        content: "升级期间不影响现有请求。",
        category: "maintenance",
        publishedAt: "2026-08-28T10:00:00Z",
        isRead: false,
      },
    ]);
  });

  it("accepts nested lists and ignores invalid entries", () => {
    expect(
      parseHRouterAnnouncements({
        data: {
          announcements: [null, { uuid: "a-1", body: "只有正文" }],
        },
      }),
    ).toMatchObject([{ id: "a-1", content: "只有正文" }]);
  });
});
