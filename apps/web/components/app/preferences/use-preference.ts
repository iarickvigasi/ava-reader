// No "use client" directive: this hook is internal infrastructure consumed
// only by the specialized preference hooks (use-translate-target-lang,
// use-font-scale, etc.), which carry the directive themselves. Keeping it
// out of the client-entry boundary lets the API accept a function `parse`
// option without tripping the "props must be serializable" lint.

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import {
  fetchPreferences,
  getCachedPreference,
  patchPreference,
  subscribePreference,
} from "./preferences-store";
import type {
  PreferenceField,
  PreferencesPayload,
} from "./preferences-types";

// Generic over string/number — the only two primitive shapes we currently
// store. The hook keeps a localStorage cache for fast paint and offline
// writes, fetches the server value once per session via the shared store,
// and reconciles when the API resolves (server wins when set, otherwise
// the local default stands).

type Primitive = string | number;

type ParseFn<T extends Primitive> = (raw: unknown) => T | null;

type UsePreferenceOptions<T extends Primitive, F extends PreferenceField> = {
  field: F;
  storageKey: string;
  defaultValue: T;
  // Parse a value coming from localStorage or the API. Returns `null` for
  // anything that doesn't look like a valid `T` (wrong type, out-of-range,
  // unparseable string, etc.) — the hook then falls back to the default
  // rather than blowing up on bad input.
  parse: ParseFn<T>;
  // Optional: produce a default from the runtime environment when there's
  // no saved value yet. Runs once after mount so it can read APIs like
  // `navigator` that aren't safe during SSR. Returning `null` keeps
  // `defaultValue`. The detected value is *not* written to localStorage or
  // the server — it's a display default that gets replaced as soon as the
  // user explicitly picks a value (or the server fetch returns one).
  getClientDefault?: () => T | null;
};

export function usePreference<T extends Primitive, F extends PreferenceField>({
  field,
  storageKey,
  defaultValue,
  parse,
  getClientDefault,
}: UsePreferenceOptions<T, F>): [T, (next: T) => void] {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [value, setValue] = useState<T>(() => {
    const fromStorage = readStorage(storageKey, parse);
    if (fromStorage !== null) return fromStorage;
    // No saved value — try the runtime default (e.g. navigator.language)
    // before the static fallback. Both readStorage and getClientDefault
    // return null on the server, so SSR ends up at defaultValue.
    if (getClientDefault) {
      const detected = getClientDefault();
      if (detected !== null) return detected;
    }
    return defaultValue;
  });

  // Re-read on cross-component / cross-tab updates.
  useEffect(() => {
    const onUpdate = () => {
      const cached = getCachedPreference(field);
      const fromCache = cached !== undefined ? parse(cached) : null;
      if (fromCache !== null) {
        setValue(fromCache);
        return;
      }
      const fromStorage = readStorage(storageKey, parse);
      if (fromStorage !== null) {
        setValue(fromStorage);
        return;
      }
      // Nothing saved anywhere — keep whatever runtime default we already
      // computed at mount (navigator-detected or static) instead of
      // resetting to the static one.
      const detected = getClientDefault?.() ?? null;
      setValue(detected ?? defaultValue);
    };
    const unsubscribe = subscribePreference(field, onUpdate);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) onUpdate();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [field, storageKey, defaultValue, parse, getClientDefault]);

  // First load: pull the canonical value from the server. If the server
  // has a value, it overrides the local cache (covers "I changed this on
  // another device"). If the server has `null`, the local default stands.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    let cancelled = false;
    fetchPreferences(getToken)
      .then((prefs) => {
        if (cancelled) return;
        const apiValue = prefs[field];
        if (apiValue == null) return;
        const decoded = parse(apiValue);
        if (decoded === null) return;
        writeStorage(storageKey, decoded);
        setValue(decoded);
      })
      .catch(() => {
        // Best effort.
      });
    return () => {
      cancelled = true;
    };
  }, [field, storageKey, getToken, isLoaded, isSignedIn, parse]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeStorage(storageKey, next);
      void patchPreference(
        getToken,
        field,
        next as unknown as PreferencesPayload[F],
      );
    },
    [field, storageKey, getToken],
  );

  return [value, update];
}

function readStorage<T extends Primitive>(
  storageKey: string,
  parse: ParseFn<T>,
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return null;
    return parse(raw);
  } catch {
    return null;
  }
}

function writeStorage<T extends Primitive>(storageKey: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, String(value));
  } catch {
    // Private-browsing / quota errors degrade silently — in-memory state
    // and the API write are already enough to keep the session coherent.
  }
}
