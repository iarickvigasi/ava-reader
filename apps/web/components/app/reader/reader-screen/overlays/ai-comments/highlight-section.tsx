import {
  ChevronDownIcon,
  ReaderFavoritesIcon,
} from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";
import {
  HIGHLIGHT_COLOR_HEX,
  type HighlightColor,
} from "../highlights/highlights-data";

const HIGHLIGHT_COLOR_ORDER: HighlightColor[] = [
  "apricot",
  "mimosa",
  "jade",
  "sky",
  "lavender",
  "rose",
  "mauve",
];

type HighlightSectionProps = {
  selectedColor: HighlightColor | null;
  onSelectColor: (color: HighlightColor) => void;
};

export function HighlightSection({
  selectedColor,
  onSelectColor,
}: HighlightSectionProps) {
  return (
    <section className="rounded-[10px]">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <ReaderFavoritesIcon className="size-4 text-copy" />
          <span className="font-(--font-ui) text-[0.78rem] uppercase tracking-[0.16em] text-copy">
            Highlight
          </span>
        </div>
        <ChevronDownIcon className="size-3.5 text-copy" />
      </div>
      <div className="flex items-center gap-3 border-t border-paper-strong/50 px-5 pb-6 pt-4">
        {HIGHLIGHT_COLOR_ORDER.map((color) => (
          <HighlightColorSwatch
            key={color}
            color={color}
            isSelected={selectedColor === color}
            onSelect={() => onSelectColor(color)}
          />
        ))}
      </div>
    </section>
  );
}

function HighlightColorSwatch({
  color,
  isSelected,
  onSelect,
}: {
  color: HighlightColor;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`Highlight ${color}`}
      onClick={onSelect}
      className={cn(
        "size-8 shrink-0 rounded-xl transition",
        isSelected
          ? "shadow-[0_0_0_2px_var(--paper),0_0_0_4px_var(--ink)]"
          : "hover:scale-105",
      )}
      style={{ backgroundColor: HIGHLIGHT_COLOR_HEX[color] }}
    />
  );
}
