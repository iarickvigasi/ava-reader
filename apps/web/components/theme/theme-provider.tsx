"use client";

import { useAuth } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  fetchPreferences,
  patchPreference,
} from "@/components/app/preferences/preferences-store";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const STORAGE_KEY = "ava-theme";
const THEME_EVENT = "ava-theme-change";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const ThemeContext = createContext<ThemeContextValue | null>(null);

function persistTheme(theme: Theme) {
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

function getStoredTheme(initialTheme: Theme): Theme {
  if (typeof window === "undefined") {
    return initialTheme;
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);

  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return initialTheme;
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleThemeChange = () => {
    onStoreChange();
  };

  window.addEventListener(THEME_EVENT, handleThemeChange);
  window.addEventListener("storage", handleThemeChange);

  return () => {
    window.removeEventListener(THEME_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleThemeChange);
  };
}

function getThemeSnapshot(initialTheme: Theme): Theme {
  return getStoredTheme(initialTheme);
}

function getServerThemeSnapshot(initialTheme: Theme): Theme {
  return initialTheme;
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: Theme;
}) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const theme = useSyncExternalStore(
    subscribe,
    () => getThemeSnapshot(initialTheme),
    () => getServerThemeSnapshot(initialTheme),
  );
  // We optimistically updated the API on the last toggle — don't echo that
  // change back into the cookie/localStorage on the next reconciliation.
  const lastWrittenRef = useRef<Theme | null>(null);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  // Cross-device reconciliation. After hydration, GET /me/preferences and
  // adopt the server's theme if it differs from what the cookie carried in.
  // The cookie still drives the *first* paint, so this can't cause a
  // hydration mismatch — only a one-shot transition after mount.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchPreferences(getToken)
      .then((prefs) => {
        if (cancelled) return;
        const apiTheme = prefs.theme;
        if (apiTheme !== "light" && apiTheme !== "dark") return;
        if (apiTheme === lastWrittenRef.current) return;
        const currentTheme = getStoredTheme(initialTheme);
        if (apiTheme === currentTheme) return;
        applyTheme(apiTheme);
        persistTheme(apiTheme);
        window.dispatchEvent(new Event(THEME_EVENT));
      })
      .catch(() => {
        // Best effort.
      });
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, initialTheme]);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";

    applyTheme(nextTheme);
    persistTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
    lastWrittenRef.current = nextTheme;
    void patchPreference(getToken, "theme", nextTheme);
  }, [theme, getToken]);

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
