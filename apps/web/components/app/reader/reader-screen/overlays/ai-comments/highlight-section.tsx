import { useTranslations } from "next-intl";
import {
  ChevronDownIcon,
  ReaderFavoritesIcon,
} from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";
import {
  HIGHLIGHT_COLOR_HEX,
  HIGHLIGHT_COLOR_ORDER,
  type HighlightColor,
} from "../highlights/highlights-data";
import { useHighlightsContext } from "../highlights/highlights-context";
import { useReaderSelectionContext } from "../../screen/reader-selection-context";

export function HighlightSection() {
  const t = useTranslations("reader.aiComments");
  const {
    text,
    locator,
    highlightId,
    highlightColor,
    setHighlightBinding,
  } = useReaderSelectionContext();
  const { upsertHighlight, deleteHighlight } = useHighlightsContext();

  const handleSelect = (color: HighlightColor) => {
    if (!text) {
      return;
    }
    // Toggle off when clicking the same color on an existing highlight.
    if (highlightId && highlightColor === color) {
      deleteHighlight(highlightId);
      setHighlightBinding(null);
      return;
    }
    // Update an existing highlight in place — same id, new color.
    if (highlightId) {
      upsertHighlight({ id: highlightId, excerpt: text, color, locator });
      setHighlightBinding({ highlightId, highlightColor: color });
      return;
    }
    // Create a new highlight; bind the selection to it so subsequent clicks
    // in the same panel session toggle/replace this row instead of stacking
    // duplicates.
    const id = upsertHighlight({ excerpt: text, color, locator });
    setHighlightBinding({ highlightId: id, highlightColor: color });
  };

  return (
    <section className="rounded-[10px]">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <ReaderFavoritesIcon className="size-4 text-copy" />
          <span className="font-(--font-ui) text-[0.78rem] uppercase tracking-[0.16em] text-copy">
            {t("highlight")}
          </span>
        </div>
        <ChevronDownIcon className="size-3.5 text-copy" />
      </div>
      <div className="flex items-center gap-3 border-t border-paper-strong/50 px-5 pb-6 pt-4">
        {HIGHLIGHT_COLOR_ORDER.map((color) => (
          <HighlightColorSwatch
            key={color}
            color={color}
            isSelected={highlightColor === color}
            onSelect={() => handleSelect(color)}
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
