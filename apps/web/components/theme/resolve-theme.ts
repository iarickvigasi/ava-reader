// Pure theme resolution. The app follows the device's light/dark scheme
// (`prefers-color-scheme`); a manual toggle records an override tagged with the
// device scheme it was set against. When the device shifts light↔dark that
// segment ends, so the override goes stale and we follow the device again.

export type Theme = "light" | "dark";

export type ThemeOverride = {
  theme: Theme;
  // The device scheme at the moment the override was set. Once the device
  // scheme differs from this, a day/night boundary has been crossed and the
  // override no longer applies.
  setAgainst: Theme;
};

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

// Parse a raw localStorage string into an override, tolerating absent or
// corrupt values (hand-edited storage, an older format) by returning null.
export function parseOverride(raw: string | null): ThemeOverride | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      isTheme((parsed as ThemeOverride).theme) &&
      isTheme((parsed as ThemeOverride).setAgainst)
    ) {
      const { theme, setAgainst } = parsed as ThemeOverride;
      return { theme, setAgainst };
    }
  } catch {
    // Corrupt JSON — fall through to null.
  }
  return null;
}

export function isOverrideActive(
  deviceScheme: Theme,
  override: ThemeOverride | null,
): boolean {
  return override !== null && override.setAgainst === deviceScheme;
}

export function resolveTheme(
  deviceScheme: Theme,
  override: ThemeOverride | null,
): Theme {
  return isOverrideActive(deviceScheme, override)
    ? (override as ThemeOverride).theme
    : deviceScheme;
}

export function toggleOverride(
  deviceScheme: Theme,
  override: ThemeOverride | null,
): ThemeOverride | null {
  const current = resolveTheme(deviceScheme, override);
  const next: Theme = current === "light" ? "dark" : "light";
  // Toggling back to what the device already shows means "just follow the
  // device" — drop the override rather than pinning the device's own value.
  if (next === deviceScheme) {
    return null;
  }
  return { theme: next, setAgainst: deviceScheme };
}
