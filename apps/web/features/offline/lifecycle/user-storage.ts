// User-scoped client storage (localStorage + cookies) cleared on sign-out and
// account switch (adr/5, spec 16). These keys are GLOBAL (not per-user), so they
// carry the previous account's data until cleared. Keep in sync with the owners:
// preference hooks (`ava.*`), theme-provider (`ava-theme` + cookie),
// interface-lang (`ava-locale` cookie), resume (`ava-reader:resume:*`),
// seen-modal (`ava-offline-modal:seen`).

const USER_KEY_PREFIXES = ["ava.", "ava-reader:resume"];
const USER_KEY_EXACT = ["ava-theme", "ava-offline-modal:seen"];
// Non-httpOnly cookies the client wrote for SSR (theme, locale) — expirable here.
const USER_COOKIES = ["ava-theme", "ava-locale"];

export function clearUserScopedClientStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const ls = window.localStorage;
    // Collect first, then remove: deleting while iterating shifts indices.
    const toRemove: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key) {
        continue;
      }
      if (
        USER_KEY_EXACT.includes(key) ||
        USER_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
      ) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      ls.removeItem(key);
    }
  } catch {
    // localStorage disabled — best effort.
  }

  if (typeof document !== "undefined") {
    try {
      for (const name of USER_COOKIES) {
        document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
      }
    } catch {
      // ignore
    }
  }
}
