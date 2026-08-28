import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  HROUTER_ANNOUNCEMENTS_URL,
  parseHRouterAnnouncements,
  type HRouterAnnouncement,
} from "@/lib/hrouterAnnouncements";

const BROWSER_URL = import.meta.env.DEV
  ? "/hrouter-api/v1/announcements"
  : HROUTER_ANNOUNCEMENTS_URL;

export async function fetchHRouterAnnouncements(): Promise<
  HRouterAnnouncement[]
> {
  let payload: unknown;

  if (isTauri()) {
    payload = await invoke("fetch_hrouter_announcements");
  } else {
    const response = await fetch(BROWSER_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`HRouter 公告接口返回 HTTP ${response.status}`);
    }
    payload = await response.json();
  }

  return parseHRouterAnnouncements(payload);
}
