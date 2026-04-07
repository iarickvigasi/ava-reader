"use client";

import { MoonIcon, SunIcon } from "@/components/app/app-icons";
import { useTheme } from "@/components/theme/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const Icon = isLight ? SunIcon : MoonIcon;
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      className="inline-flex size-11 items-center justify-center rounded-[14px] bg-soft-fill text-ink transition hover:bg-soft-tone-fill/55"
    >
      <Icon className="size-5" />
    </button>
  );
}
