import { MoonIcon, SunIcon } from "@/components/app/shared/app-icons";
import { useTheme } from "@/components/theme/theme-provider";
import { SectionLabel } from "../section-label";
import { IconControlButton } from "./preferences-fields";

type ReadingSectionProps = {
  fontScale: number;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
};

export function ReadingSection({
  fontScale,
  onDecreaseFont,
  onIncreaseFont,
}: ReadingSectionProps) {
  return (
    <section className="space-y-6">
      <SectionLabel>Reading</SectionLabel>
      <div className="flex items-center gap-3">
        <FontSizeControls
          fontScale={fontScale}
          onDecreaseFont={onDecreaseFont}
          onIncreaseFont={onIncreaseFont}
        />
        <ThemeToggleControl />
      </div>
    </section>
  );
}

function FontSizeControls({
  fontScale,
  onDecreaseFont,
  onIncreaseFont,
}: {
  fontScale: number;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
}) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <FontSizeButton label="A-" onClick={onDecreaseFont} />
      <FontSizeButton label="A+" onClick={onIncreaseFont} />
      <p className="ml-2 font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-ink/45">
        Type {Math.round(fontScale * 100)}%
      </p>
    </div>
  );
}

function FontSizeButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex size-10 items-center justify-center rounded-full bg-soft-fill/80 font-(--font-ui) text-sm text-ink transition hover:bg-soft-tone-fill"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ThemeToggleControl() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const Icon = isLight ? SunIcon : MoonIcon;
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <IconControlButton
      ariaLabel={label}
      ariaPressed={!isLight}
      onClick={toggleTheme}
    >
      <Icon className="size-5" />
    </IconControlButton>
  );
}
