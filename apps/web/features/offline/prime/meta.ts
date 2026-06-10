// Thin typed accessors over the Dexie `meta` key/value table for the primer's
// bookkeeping flags. The table is per-browser-profile, which is exactly the
// granularity we want: "once per device" == "once per Dexie database".

import { getDb } from "../db";

// Tier-1 (metadata: home / library / book-info) finished a fully clean pass.
export const META_KEY_METADATA_DONE = "prime:metadata:doneAt";
// Tier-2 (book content) reached a terminal state — every book cached or the
// storage floor hit. Not required for the metadata tier to be considered done.
export const META_KEY_CONTENT_DONE = "prime:content:doneAt";
// Both tiers reached their terminal state; the primer never runs again on
// this device.
export const META_KEY_COMPLETED = "prime:completed";
// Whether the user has agreed to download content on a Data Saver connection.
// Set to "granted" once they accept the modal, so we don't ask again. A decline
// is deliberately NOT persisted: it only suppresses the current run. Next time
// the connection may no longer be metered (so content runs with no prompt), or
// the user may decide differently — so we re-offer. Only consulted when
// Save-Data is on; off connections never need consent.
export const META_KEY_CONTENT_CONSENT = "prime:content:consent";
export const CONTENT_CONSENT_GRANTED = "granted";
// Route-shell precaching (see [[14-route-precaching]]) finished a full pass:
// the library view was present, so every static + per-entity route was handed
// to the SW. Set only on full success, so a partial (library not yet hydrated)
// run retries on the next app navigation.
export const META_KEY_ROUTES_DONE = "prime:routes:doneAt";

export async function getMetaFlag(key: string): Promise<string | null> {
  const db = getDb();
  const row = await db.meta.get(key);
  return typeof row?.value === "string" ? row.value : row?.value ? "1" : null;
}

export async function setMetaFlag(key: string, value: string): Promise<void> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  await db.meta.put({ key, value, updatedAt: nowIso });
}

export async function hasMetaFlag(key: string): Promise<boolean> {
  return (await getMetaFlag(key)) !== null;
}
