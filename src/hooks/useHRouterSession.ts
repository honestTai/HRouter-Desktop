import { useSyncExternalStore } from "react";
import {
  getHRouterSession,
  subscribeHRouterSession,
} from "@/lib/api/hrouterPlatform";

let cachedRaw: string | null | undefined;
let cachedSession = getHRouterSession();

function getSnapshot() {
  const raw = localStorage.getItem("hrouter-account-session");
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = getHRouterSession();
  }
  return cachedSession;
}

export function useHRouterSession() {
  return useSyncExternalStore(subscribeHRouterSession, getSnapshot, () => null);
}
