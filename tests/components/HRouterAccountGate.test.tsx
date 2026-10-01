import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
const auth = vi.hoisted(() => ({
  login: vi.fn(),
  login2FA: vi.fn(),
  register: vi.fn(),
  session: null as any,
}));
vi.mock("@/hooks/useHRouterSession", () => ({
  useHRouterSession: () => auth.session,
}));
vi.mock("@/lib/api/hrouterPlatform", () => ({
  hrouterAuthApi: {
    login: auth.login,
    login2FA: auth.login2FA,
    register: auth.register,
    publicSettings: async () => ({
      registration_enabled: true,
      email_verify_enabled: false,
    }),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
beforeEach(() => {
  auth.session = null;
  auth.login.mockReset();
  auth.login2FA.mockReset();
  auth.register.mockReset();
});
it("requires TOTP without mounting private children or persisting an interim authenticated state", async () => {
  auth.login.mockResolvedValue({ requires2FA: true, tempToken: "short-lived" });
  auth.login2FA.mockRejectedValueOnce(new Error("Invalid code"));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <HRouterAccountGate>
        <div>private-account</div>
      </HRouterAccountGate>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("hrouterAccount.email"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("hrouterAccount.password"), {
    target: { value: "password123" },
  });
  const submit = screen
    .getAllByRole("button", { name: "hrouterAccount.login" })
    .find((b) => b.getAttribute("type") === "submit")!;
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);
  const code = await screen.findByLabelText("hrouterWorkspace.totp");
  expect(screen.queryByText("private-account")).toBeNull();
  fireEvent.change(code, { target: { value: "123" } });
  expect(
    screen.getByRole("button", { name: "hrouterWorkspace.verify" }),
  ).toBeDisabled();
  fireEvent.change(code, { target: { value: "123456" } });
  fireEvent.click(
    screen.getByRole("button", { name: "hrouterWorkspace.verify" }),
  );
  await waitFor(() =>
    expect(auth.login2FA).toHaveBeenCalledWith("short-lived", "123456"),
  );
  expect(screen.queryByText("private-account")).toBeNull();
});
