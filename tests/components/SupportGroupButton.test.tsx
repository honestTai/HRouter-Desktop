import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportGroupButton } from "@/components/SupportGroupButton";

const writeText = vi.fn(async () => undefined);

describe("SupportGroupButton", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies only the QQ group number", async () => {
    render(<SupportGroupButton />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.afterSalesSupportHint",
      }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("978834782");
    });
  });
});
