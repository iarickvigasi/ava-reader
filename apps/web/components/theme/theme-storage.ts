// Browser side-effects for theming: reading the device scheme, and reading /
// writing / persisting the override and resolved theme. All pure decisions
// live in resolve-theme.ts; this module only touches `window`.

import { parseOverride, type Theme, type ThemeOverride } from "./resolve-theme";

export const THEME_EVENT = "ava-theme-change";
const THEME_KEY = "ava-theme";
const OVERRIDE_KEY = "ava-theme-override";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const PREFERS_DARK = "(prefers-color-scheme: dark)";

export function readDeviceScheme(): Theme {
  return window.matchMedia(PREFERS_DARK).matches ? "dark" : "light";
}

export function readOverride(): ThemeOverride | null {
  try {
    return parseOverride(window.localStorage.getItem(OVERRIDE_KEY));
  } catch {
    return null;
  }
}

export function writeOverride(override: ThemeOverride | null): void {
  try {
    if (override) {
      window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(override));
    } else {
      window.localStorage.removeItem(OVERRIDE_KEY);
    }
  } catch {
    // localStorage unavailable — the override just won't persist.
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

// Persist the *resolved* theme for the SSR baseline (cookie) and cross-tab
// reads (localStorage). The device scheme + override still decide the value.
export function persistResolvedTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Non-fatal: cross-tab read falls back to the cookie/device.
  }
  document.cookie = `${THEME_KEY}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

// Notify on anything that can change the effective theme: device light↔dark
// shifts (which end the current segment) and same-/cross-tab override changes.
// A device shift discards the override before notifying, so the theme snaps
// back to the device.
export function subscribeTheme(onChange: () => void): () => void {
  const media = window.matchMedia(PREFERS_DARK);
  const onDeviceShift = () => {
    writeOverride(null);
    onChange();
  };
  const onOverrideChange = () => onChange();

  media.addEventListener("change", onDeviceShift);
  window.addEventListener(THEME_EVENT, onOverrideChange);
  window.addEventListener("storage", onOverrideChange);

  return () => {
    media.removeEventListener("change", onDeviceShift);
    window.removeEventListener(THEME_EVENT, onOverrideChange);
    window.removeEventListener("storage", onOverrideChange);
  };
}
