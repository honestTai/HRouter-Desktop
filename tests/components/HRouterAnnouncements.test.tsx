import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HRouterAnnouncements } from "@/components/HRouterAnnouncements";
import { HROUTER_ANNOUNCEMENTS_URL } from "@/lib/hrouterAnnouncements";

const queryState = vi.hoisted(() => ({
  data: [] as Array<{
    id: string;
    title: string;
    content: string;
    publishedAt?: string;
    isRead: boolean;
  }>,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => queryState,
}));

describe("HRouterAnnouncements", () => {
  beforeEach(() => {
    queryState.data = [];
    queryState.isLoading = false;
    queryState.isFetching = false;
    queryState.isError = false;
    queryState.refetch.mockReset();
  });

  it("renders announcements as native app content without an iframe", () => {
    queryState.data = [
      {
        id: "notice-1",
        title: "平台维护通知",
        content: "维护期间现有 API 请求不受影响。",
        isRead: false,
      },
    ];

    const { container } = render(<HRouterAnnouncements />);

    expect(screen.getByText("平台维护通知")).toBeInTheDocument();
    expect(
      screen.getByText("维护期间现有 API 请求不受影响。"),
    ).toBeInTheDocument();
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("shows the direct endpoint when the API is not open yet", () => {
    queryState.isError = true;

    render(<HRouterAnnouncements />);

    expect(
      screen.getByText(`GET ${HROUTER_ANNOUNCEMENTS_URL}`),
    ).toBeInTheDocument();
  });
});
