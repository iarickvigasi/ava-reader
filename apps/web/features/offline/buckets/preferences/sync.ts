// Sync runner for the preferences bucket. Drains the dirty list into a
// single PATCH per cycle — server treats PATCH bodies as a partial update,
// so coalescing N dirty fields into one call matches the server's own model.
//
// One in-flight flush at a time. Failure → leave the dirty list intact and
// the next online event tries again. Success → strip the synced fields
// from the dirty list.

import { getPublicApiBaseUrl } from "@/lib/api";

import { markFieldsClean, readPreferences } from "./storage";

type GetToken = () => Promise<string | null>;

let flushing: Promise<void> | null = null;

export async function flushPreferences(getToken: GetToken): Promise<void> {
  if (flushing) {
    return flushing;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }
  flushing = doFlush(getToken).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(getToken: GetToken): Promise<void> {
  const { values, dirtyFields } = await readPreferences();
  if (dirtyFields.length === 0) {
    return;
  }
  const token = await getToken();
  if (!token) {
    return;
  }
  const body: Record<string, unknown> = {};
  for (const field of dirtyFields) {
    body[field] = values[field];
  }
  try {
    const response = await fetch(
      `${getPublicApiBaseUrl()}/api/me/preferences`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      // Transient — leave the dirty list intact, next online tick retries.
      return;
    }
    await markFieldsClean(dirtyFields);
  } catch {
    // Network blip — same recovery as a 5xx.
  }
}

// Test-only: clear the module flush guard so each case starts fresh.
export function __resetPreferencesSyncForTests() {
  flushing = null;
}
