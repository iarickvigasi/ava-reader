// Module-level coordination layer for the per-user preferences API. We keep
// it out of React state so multiple `usePreference` hooks on the same page
// share a single GET (deduped via `inflightFetch`) and writes from one hook
// instance propagate to peers without prop drilling or context.

import {
  applyServerPreferences,
  flushPreferences,
  markFieldDirty,
  readPreferences,
} from "@/features/offline/buckets/preferences";
import { getPublicApiBaseUrl } from "@/lib/api";

import type {
  PreferenceField,
  PreferencesPayload,
} from "./preferences-types";

type GetTokenFn = () => Promise<string | null>;

let cache: Partial<PreferencesPayload> | null = null;
let inflightFetch: Promise<Partial<PreferencesPayload>> | null = null;

const listeners = new Map<PreferenceField, Set<() => void>>();

function listenerSet(field: PreferenceField): Set<() => void> {
  let set = listeners.get(field);
  if (!set) {
    set = new Set();
    listeners.set(field, set);
  }
  return set;
}

function notify(field: PreferenceField) {
  listenerSet(field).forEach((listener) => listener());
}

export function getCachedPreference<F extends PreferenceField>(
  field: F,
): PreferencesPayload[F] | undefined {
  return cache?.[field];
}

export function subscribePreference(
  field: PreferenceField,
  listener: () => void,
): () => void {
  const set = listenerSet(field);
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

// Fetch the user's preferences once per page load. Concurrent callers
// receive the same in-flight promise, so a page with multiple `usePreference`
// hooks issues a single GET. The result is cached for the lifetime of the
// module, which matches a normal app session.
//
// Two extra concerns vs. the original module-only cache:
//   1. Before the network fetch resolves, we seed `cache` from Dexie so a
//      fresh tab opened offline still has the user's last-known values.
//   2. After the network fetch, we apply the server snapshot via
//      `applyServerPreferences` which respects locally-dirty fields —
//      preserving any change the user made offline that hasn't synced yet.
export async function fetchPreferences(
  getToken: GetTokenFn,
): Promise<Partial<PreferencesPayload>> {
  if (cache) {
    return cache;
  }
  if (inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = (async () => {
    // Step 1: warm the cache from Dexie immediately. This makes a fresh
    // offline tab usable; the network fetch below either overlays the
    // server view on top (online) or no-ops (offline + non-2xx).
    try {
      const local = await readPreferences();
      if (Object.keys(local.values).length > 0) {
        cache = local.values as Partial<PreferencesPayload>;
        (Object.keys(cache) as PreferenceField[]).forEach(notify);
      }
    } catch {
      // Dexie unavailable — bypass the cache warmup.
    }

    try {
      const token = await getToken();
      if (!token) {
        return cache ?? {};
      }
      const response = await fetch(
        `${getPublicApiBaseUrl()}/api/me/preferences`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      if (!response.ok) {
        return cache ?? {};
      }
      const json = (await response.json()) as Partial<PreferencesPayload>;
      // Step 2: apply server snapshot via the Dexie helper that preserves
      // locally-dirty fields. The result is what the user effectively sees.
      try {
        await applyServerPreferences(
          json as Record<string, unknown>,
        );
        const merged = await readPreferences();
        cache = merged.values as Partial<PreferencesPayload>;
      } catch {
        cache = json;
      }
      (Object.keys(cache ?? {}) as PreferenceField[]).forEach(notify);
      // Step 3: if the dirty queue had fields from a prior session, drain
      // them now that we have a token.
      void flushPreferences(getToken).catch(() => {});
      return cache ?? {};
    } catch {
      return cache ?? {};
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

// Optimistically update the in-memory cache, mirror the change into Dexie
// (marking the field dirty), and attempt a PATCH.
//
// Offline path: the PATCH may fail or be skipped (no token, no connection).
// The dirty-field marker stays in Dexie so the next online tick can
// coalesce + flush via `flushPreferences`. Callers don't need to await
// anything beyond the optimistic update — localStorage holds the new value
// for fast paint and Dexie holds it durably with the dirty marker.
export async function patchPreference<F extends PreferenceField>(
  getToken: GetTokenFn,
  field: F,
  value: PreferencesPayload[F],
): Promise<void> {
  if (!cache) {
    cache = {};
  }
  cache[field] = value;
  notify(field);

  // Persist + mark dirty in Dexie. Fire-and-forget; storage failures don't
  // break the in-memory experience but do prevent eventual sync, which is
  // acceptable degradation (matches the original module). Swallow the
  // rejection so it doesn't surface as an unhandled promise rejection in
  // environments where IndexedDB isn't available (SSR-flavoured tests).
  void markFieldDirty(field, value).catch(() => {});

  try {
    const token = await getToken();
    if (!token) {
      return;
    }
    const response = await fetch(
      `${getPublicApiBaseUrl()}/api/me/preferences`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [field]: value }),
      },
    );
    if (response.ok) {
      // Drain the queue so this field (and any other prior dirty siblings)
      // get cleared from the dirty list. Idempotent — markFieldsClean only
      // touches fields it was passed.
      void flushPreferences(getToken).catch(() => {});
    }
    // On non-ok, the dirty marker stays; next online tick retries.
  } catch {
    // Same recovery path — dirty marker stays in Dexie.
  }
}

// Test-only: reset the module-level state so unit tests don't leak the
// cache between cases. Not exported through any index file.
export function __resetPreferencesStoreForTests() {
  cache = null;
  inflightFetch = null;
  listeners.clear();
}
