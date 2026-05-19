"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n/locales";
import { usePreference } from "./use-preference";

const STORAGE_KEY = "ava.interfaceLang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function parseInterfaceLang(raw: unknown): Locale | null {
  return isLocale(raw) ? raw : null;
}

function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`),
  );
  return match ? parseInterfaceLang(decodeURIComponent(match[1])) : null;
}

function persistLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function useInterfaceLang(): [Locale, (next: Locale) => void] {
  const router = useRouter();
  const [locale, setLocale] = usePreference({
    field: "interfaceLang",
    storageKey: STORAGE_KEY,
    defaultValue: defaultLocale,
    parse: parseInterfaceLang,
  });

  // Reconcile the cookie with the authoritative preference value. The server
  // picks the message bundle from the cookie, but the DB (fetched async by
  // usePreference) is the source of truth — if they disagree (stale cookie,
  // Accept-Language fallback, change made on another device), sync the
  // cookie and soft-refresh so the bundle matches the dropdown.
  useEffect(() => {
    if (readLocaleCookie() === locale) return;
    persistLocaleCookie(locale);
    router.refresh();
  }, [locale, router]);

  const update = useCallback(
    (next: Locale) => {
      setLocale(next);
      persistLocaleCookie(next);
      router.refresh();
    },
    [setLocale, router],
  );

  return [locale, update];
}
