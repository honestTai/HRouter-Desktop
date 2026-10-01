import { APP_IDS } from "@/config/appConfig";
import type { AppId } from "@/lib/api/types";
import type { Profile, ProfileScope } from "@/lib/api/profiles";
export const APP_PROFILE_SCOPE = Object.fromEntries(
  APP_IDS.map((id) => [id, id]),
) as Record<AppId, ProfileScope>;
export function hasScopeSnapshot(profile: Profile, scope: ProfileScope) {
  const { providers, enabled_providers, mcp, skills } = profile.payload;
  return (
    providers[scope] != null ||
    enabled_providers?.[scope] != null ||
    mcp[scope] != null ||
    skills[scope] != null
  );
}
