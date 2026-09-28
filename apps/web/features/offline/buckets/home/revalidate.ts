import { fetchWithConnectivityCheck } from "../../net/fetch-with-connectivity-check";
import { deviceTimeZone } from "../../stats/device-time-zone";
// Client-side revalidation of the home payload. Runs after the page hydrates
// while online and on every transition back online, refreshing the Dexie
// cache so the next offline open shows recent data.

import type { HomePayload } from "@/lib/api-types/home";

import { getPublicApiBaseUrl } from "@/lib/api";

import { applyHome } from "./storage";
import { getDb } from "../../db";
import { readCompletionRevision } from "../../completion/state";

type GetToken = () => Promise<string | null>;

export async function revalidateHome(getToken: GetToken): Promise<void> {
  const db = getDb();
  const timeZone = deviceTimeZone();
  const expectedCompletionRevision = await readCompletionRevision(db);
  const token = await getToken();
  if (!token || db !== getDb()) {
    return;
  }
  try {
    const response = await fetchWithConnectivityCheck(
      `${getPublicApiBaseUrl()}/api/home?timeZone=${encodeURIComponent(timeZone)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as HomePayload;
    if (db !== getDb() || timeZone !== deviceTimeZone()) return;
    await applyHome(payload, { db, expectedCompletionRevision });
  } catch {
    // Network blip — the cached payload stays. Next online tick retries.
  }
}
