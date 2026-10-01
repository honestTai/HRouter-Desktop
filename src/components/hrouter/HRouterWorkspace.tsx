import { useState } from "react";
import {
  ChevronRight,
  Home,
  KeyRound,
  UserRound,
  CreditCard,
  ReceiptText,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useHRouterAccess } from "@/hooks/useHRouterAccess";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { HRouterAccountGate } from "./HRouterAccountGate";
import { HRouterDashboard } from "@/components/HRouterDashboard";
import { HRouterUsagePage } from "./HRouterUsagePage";
import { HRouterApiKeysPage } from "./HRouterApiKeysPage";
import { HRouterProfilePage } from "./HRouterProfilePage";
import { HRouterBillingPage } from "./HRouterBillingPage";
import { HRouterOrdersPage } from "./HRouterOrdersPage";
import { HRouterLogout } from "./HRouterPageShell";
import { HRouterEmbeddedContext } from "./workspaceContext";

type Page = "home" | "keys" | "profile" | "payment" | "orders";

/** A single account workspace; unauthenticated users never mount private queries. */
export function HRouterWorkspace() {
  const { connected, isLoading } = useHRouterAccess();
  const session = useHRouterSession();
  if (isLoading && !connected) return null;
  if (!connected) return null;
  return (
    <HRouterAccountGate>
      <WorkspaceContent key={session?.user.id ?? "login"} />
    </HRouterAccountGate>
  );
}

function WorkspaceContent() {
  const { t } = useTranslation();
  const [page, setPage] = useState<Page>("home");
  const pages = [
    ["home", Home, t("hrouterWorkspace.home")],
    ["keys", KeyRound, t("navigation.apiKeys")],
    ["profile", UserRound, t("hrouterWorkspace.profile")],
    ["payment", CreditCard, t("hrouterWorkspace.payment")],
  ] as const;
  const title =
    page === "orders"
      ? t("navigation.orders")
      : pages.find(([id]) => id === page)![2];
  return (
    <HRouterEmbeddedContext.Provider value>
      <div
        className="flex h-full min-h-0 flex-col"
        data-testid="hrouter-workspace"
      >
        <div className="shrink-0 border-b bg-card px-6 py-4 lg:px-8">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
            <nav
              aria-label={t("hrouterWorkspace.breadcrumb")}
              className="flex items-center gap-2 text-sm"
            >
              <Button variant="ghost" size="sm" onClick={() => setPage("home")}>
                HRouter
              </Button>
              <ChevronRight className="size-4 text-muted-foreground" />
              {page !== "home" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage("home")}
                  >
                    {t("hrouterWorkspace.home")}
                  </Button>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </>
              )}
              {page === "orders" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage("payment")}
                  >
                    {t("hrouterWorkspace.payment")}
                  </Button>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </>
              )}
              <span aria-current="page" className="font-semibold">
                {title}
              </span>
            </nav>
            <HRouterLogout />
          </div>
          <nav
            aria-label={t("hrouterWorkspace.navigation")}
            className="mx-auto mt-3 flex max-w-[1500px] flex-wrap gap-2"
          >
            {pages.map(([id, Icon, label]) => (
              <Button
                key={id}
                variant={
                  page === id || (id === "payment" && page === "orders")
                    ? "default"
                    : "outline"
                }
                onClick={() => setPage(id)}
                aria-current={page === id ? "page" : undefined}
              >
                <Icon className="size-4" />
                {label}
              </Button>
            ))}
            {(page === "payment" || page === "orders") && (
              <Button variant="ghost" onClick={() => setPage("orders")}>
                <ReceiptText className="size-4" />
                {t("navigation.orders")}
              </Button>
            )}
          </nav>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-6 lg:p-8">
          <div className="mx-auto max-w-[1500px] space-y-6">
            {page === "home" && (
              <>
                <section aria-label={t("hrouterWorkspace.overview")}>
                  <HRouterDashboard />
                </section>
                <section
                  aria-label={t("hrouterWorkspace.records")}
                  className="h-[760px] min-h-[480px]"
                >
                  <HRouterUsagePage />
                </section>
              </>
            )}
            {page === "keys" && <HRouterApiKeysPage />}
            {page === "profile" && <HRouterProfilePage />}
            {page === "payment" && <HRouterBillingPage />}
            {page === "orders" && <HRouterOrdersPage />}
          </div>
        </main>
      </div>
    </HRouterEmbeddedContext.Provider>
  );
}
