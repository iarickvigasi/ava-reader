// Background fetch of the user's preferences into the offline cache. Used by
// the cache primer so reader settings (theme, font scale, languages) are
// available offline without first opening the settings screen. Dirty local
// fields are preserved by applyServerPreferences. Best-effort.

import { getPublicApiBaseUrl } from "@/lib/api";

import { applyServerPreferences, type PreferencesValues } from "./storage";

type GetToken = () => Promise<string | null>;

export async function revalidatePreferences(getToken: GetToken): Promise<void> {
  const token = await getToken();
  if (!token) {
    return;
  }
  try {
    const response = await fetch(
      `${getPublicApiBaseUrl()}/api/me/preferences`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
    );
    if (!response.ok) {
      return;
    }
    const values = (await response.json()) as PreferencesValues;
    await applyServerPreferences(values);
  } catch {
    // Network blip — cached preferences (if any) stand.
  }
}
