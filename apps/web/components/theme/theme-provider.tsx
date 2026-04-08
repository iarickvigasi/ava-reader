"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

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
  const theme = useSyncExternalStore(
    subscribe,
    () => getThemeSnapshot(initialTheme),
    () => getServerThemeSnapshot(initialTheme),
  );

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => {
          const nextTheme = theme === "light" ? "dark" : "light";

          applyTheme(nextTheme);
          persistTheme(nextTheme);
          window.dispatchEvent(new Event(THEME_EVENT));
        },
      }}
    >
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
