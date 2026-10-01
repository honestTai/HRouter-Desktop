import { useQueries } from "@tanstack/react-query";
import { APP_IDS } from "@/config/appConfig";
import { providersApi } from "@/lib/api";
import { hasHRouterKey } from "@/lib/hrouterAccess";
import { useHRouterSession } from "@/hooks/useHRouterSession";

/** Provider-scoped keys ensure add/edit/delete/import invalidations update every surface. */
export function useHRouterAccess() {
  const session = useHRouterSession();
  const queries = useQueries({
    queries: APP_IDS.map((app) => ({
      queryKey: ["providers", app, "hrouter-access"],
      queryFn: async () =>
        Object.values(await providersApi.getAll(app)).some((provider) =>
          hasHRouterKey(app, provider),
        ),
      staleTime: 30_000,
    })),
  });
  const connected = queries.some((query) => query.data === true);
  return {
    isLoading: queries.some((query) => query.isPending),
    connected,
    cloudEnabled: connected && !!session,
    session,
  };
}
