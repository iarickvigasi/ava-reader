// Client-side revalidation of the home payload. Runs after the page hydrates
// while online and on every transition back online, refreshing the Dexie
// cache so the next offline open shows recent data.

import type { HomePayload } from "@/lib/api-types/home";

import { getPublicApiBaseUrl } from "@/lib/api";

import { applyHome } from "./storage";

type GetToken = () => Promise<string | null>;

export async function revalidateHome(getToken: GetToken): Promise<void> {
  const token = await getToken();
  if (!token) {
    return;
  }
  try {
    const response = await fetch(`${getPublicApiBaseUrl()}/api/home`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as HomePayload;
    await applyHome(payload);
  } catch {
    // Network blip — the cached payload stays. Next online tick retries.
  }
}
