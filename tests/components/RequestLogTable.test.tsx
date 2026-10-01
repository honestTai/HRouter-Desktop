import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RequestLogTable,
  RequestTiming,
} from "@/components/usage/RequestLogTable";
import type { UsageRangeSelection } from "@/types/usage";

const useRequestLogsMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: {
        defaultValue?: string;
      },
    ) => options?.defaultValue ?? key,
    i18n: {
      resolvedLanguage: "en",
      language: "en",
    },
  }),
}));

vi.mock("@/lib/query/usage", () => ({
  useRequestLogs: (args: unknown) => useRequestLogsMock(args),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder ?? null}</span>,
  SelectContent: () => null,
  SelectItem: () => null,
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: any) => <th {...props}>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));

describe("RequestLogTable", () => {
  beforeEach(() => {
    useRequestLogsMock.mockReset();
    useRequestLogsMock.mockImplementation(
      ({ page = 0, pageSize = 20 }: { page?: number; pageSize?: number }) => ({
        data: {
          data: [],
          total: 120,
          page,
          pageSize,
        },
        isLoading: false,
      }),
    );
  });

  it("labels actual duration and first-token timing independently, preferring full duration", () => {
    render(
      <RequestTiming
        log={{
          durationMs: 2400,
          latencyMs: 250,
          firstTokenMs: 250,
          dataSource: "proxy",
        }}
      />,
    );
    expect(screen.getByText("2.40 s")).toBeVisible();
    expect(screen.getByText("250 ms")).toBeVisible();
    expect(screen.getByText("usage.durationLabel")).toBeVisible();
    expect(screen.getByText("usage.firstTokenLabel")).toBeVisible();
  });
  it("does not fabricate timing for imported sessions or invalid numbers", () => {
    render(
      <RequestTiming
        log={{ latencyMs: 0, firstTokenMs: NaN, dataSource: "codex_session" }}
      />,
    );
    expect(screen.getAllByText("usage.timingMissing")).toHaveLength(2);
  });
  it("attributes all-Agent rows and does not invent HTTP metadata for native summaries", () => {
    const common = {
      providerName: "Local",
      model: "test-model",
      createdAt: 1700000000,
      inputTokens: 10,
      outputTokens: 4,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalCostUsd: "0",
      latencyMs: 0,
      statusCode: 200,
    };
    useRequestLogsMock.mockReturnValue({
      isLoading: false,
      data: {
        total: 2,
        data: [
          {
            ...common,
            requestId: "a",
            appType: "pi",
            dataSource: "pi_session",
          },
          {
            ...common,
            requestId: "b",
            appType: "hermes",
            dataSource: "hermes_summary",
            requestCount: 3,
          },
        ],
      },
    });
    render(
      <RequestLogTable
        range={{ preset: "today" }}
        rangeLabel="Today"
        appType="all"
        refreshIntervalMs={0}
      />,
    );
    expect(screen.getByText("Pi Agent")).toBeInTheDocument();
    expect(screen.getByText("Hermes")).toBeInTheDocument();
    expect(screen.getByText("usage.aggregatedCalls")).toBeInTheDocument();
    expect(screen.queryByText("200")).not.toBeInTheDocument();
    expect(screen.queryByText("0.0s")).not.toBeInTheDocument();
    expect(useRequestLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ appType: undefined }),
      }),
    );
  });

  it("resets pagination when the dashboard range changes", async () => {
    const initialRange: UsageRangeSelection = { preset: "today" };
    const nextRange: UsageRangeSelection = {
      preset: "custom",
      customStartDate: 1_710_000_000,
      customEndDate: 1_710_086_400,
    };

    const { rerender } = render(
      <RequestLogTable
        range={initialRange}
        rangeLabel="Today"
        appType="all"
        refreshIntervalMs={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() => {
      expect(useRequestLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          range: initialRange,
        }),
      );
    });

    rerender(
      <RequestLogTable
        range={nextRange}
        rangeLabel="Custom"
        appType="all"
        refreshIntervalMs={0}
      />,
    );

    await waitFor(() => {
      expect(useRequestLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 0,
          range: nextRange,
        }),
      );
    });
  });

  it("resets pagination when the dashboard app filter changes", async () => {
    const range: UsageRangeSelection = { preset: "today" };
    const { rerender } = render(
      <RequestLogTable
        range={range}
        rangeLabel="Today"
        appType="all"
        refreshIntervalMs={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() => {
      expect(useRequestLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          range,
        }),
      );
    });

    rerender(
      <RequestLogTable
        range={range}
        rangeLabel="Today"
        appType="claude"
        refreshIntervalMs={0}
      />,
    );

    await waitFor(() => {
      expect(useRequestLogsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 0,
          range,
        }),
      );
    });
  });
});
