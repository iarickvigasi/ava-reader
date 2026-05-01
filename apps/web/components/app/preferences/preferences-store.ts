// Module-level coordination layer for the per-user preferences API. We keep
// it out of React state so multiple `usePreference` hooks on the same page
// share a single GET (deduped via `inflightFetch`) and writes from one hook
// instance propagate to peers without prop drilling or context.

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
    try {
      const token = await getToken();
      if (!token) {
        return {};
      }
      const response = await fetch(
        `${getPublicApiBaseUrl()}/api/me/preferences`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      if (!response.ok) {
        return {};
      }
      const json = (await response.json()) as Partial<PreferencesPayload>;
      cache = json;
      // Wake up every hook that subscribed before the fetch resolved.
      (Object.keys(json) as PreferenceField[]).forEach(notify);
      return json;
    } catch {
      return {};
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

// Optimistically update the in-memory cache and PATCH the API. We don't
// `await` the network response in callers — localStorage already has the
// new value (the hook writes it before calling us), so a transient API
// failure surfaces as "this tab won, the change just won't sync to other
// devices yet". The next mutation, or the next page load's GET, recovers.
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

  try {
    const token = await getToken();
    if (!token) {
      return;
    }
    await fetch(`${getPublicApiBaseUrl()}/api/me/preferences`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [field]: value }),
    });
  } catch {
    // Best effort. The optimistic cache + localStorage already reflect the
    // new value; we'll re-sync on the next mutation or page load.
  }
}

// Test-only: reset the module-level state so unit tests don't leak the
// cache between cases. Not exported through any index file.
export function __resetPreferencesStoreForTests() {
  cache = null;
  inflightFetch = null;
  listeners.clear();
}
