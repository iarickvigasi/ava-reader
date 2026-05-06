"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
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

  const update = useCallback(
    (next: Locale) => {
      setLocale(next);
      persistLocaleCookie(next);
      // Soft-refresh server components so getRequestConfig re-reads the
      // cookie and ships the new message bundle.
      router.refresh();
    },
    [setLocale, router],
  );

  return [locale, update];
}
