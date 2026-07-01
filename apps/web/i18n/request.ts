import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "./locales";
import { matchAcceptLanguage } from "./match-accept-language";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    return loadConfig(cookieLocale);
  }

  // No explicit choice yet — try to match the browser's Accept-Language
  // (which reflects the OS interface language) against our supported set.
  const headerStore = await headers();
  const matched = matchAcceptLanguage(headerStore.get("accept-language"));
  return loadConfig(matched ?? defaultLocale);
});

async function loadConfig(locale: string) {
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
}
