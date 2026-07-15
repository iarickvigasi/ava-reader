"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  isOverrideActive,
  resolveTheme,
  toggleOverride,
  type Theme,
} from "./resolve-theme";
import {
  applyTheme,
  persistResolvedTheme,
  readDeviceScheme,
  readOverride,
  subscribeTheme,
  THEME_EVENT,
  writeOverride,
} from "./theme-storage";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getThemeSnapshot(initialTheme: Theme): Theme {
  if (typeof window === "undefined") {
    return initialTheme;
  }
  return resolveTheme(readDeviceScheme(), readOverride());
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: Theme;
}) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => getThemeSnapshot(initialTheme),
    () => initialTheme,
  );

  // Keep the DOM attribute and the SSR/cross-tab baselines in step with the
  // resolved theme — on mount and on every device shift or override change.
  useEffect(() => {
    applyTheme(theme);
    persistResolvedTheme(theme);
  }, [theme]);

  // On load, discard an override left over from a segment that has since ended
  // (the device shifted while the app was closed), so a later shift back to
  // that scheme can't resurrect it.
  useEffect(() => {
    const override = readOverride();
    if (override && !isOverrideActive(readDeviceScheme(), override)) {
      writeOverride(null);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const device = readDeviceScheme();
    const next = toggleOverride(device, readOverride());
    writeOverride(next);
    const resolved = resolveTheme(device, next);
    applyTheme(resolved);
    persistResolvedTheme(resolved);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return value;
}
