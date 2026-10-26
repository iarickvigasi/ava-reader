import { PanelPlaceholder } from "../panel-placeholder";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { HighlightRow } from "./highlight-row";
import type { Highlight } from "./highlights-data";

type HighlightsListSectionProps = {
  highlights: Highlight[];
  onDelete?: (id: string) => void;
  onSelect?: (id: string) => void;
};

export function HighlightsListSection({
  highlights,
  onDelete,
  onSelect,
}: HighlightsListSectionProps) {
  const [openMenuHighlightId, setOpenMenuHighlightId] = useState<string | null>(
    null,
  );
  const t = useTranslations("reader.highlights");

  if (highlights.length === 0) {
    return <PanelPlaceholder>{t("empty")}</PanelPlaceholder>;
  }

  return (
    <ul
      className="min-h-0 flex-1 space-y-2 overflow-auto pb-8 pr-2"
      onClick={(event) => {
        // Clicking the empty list region closes any open row menu.
        if (event.target === event.currentTarget) {
          setOpenMenuHighlightId(null);
        }
      }}
    >
      {highlights.map((highlight) => (
        <li key={highlight.id}>
          <HighlightRow
            highlight={highlight}
            isMenuOpen={openMenuHighlightId === highlight.id}
            onMenuToggle={() =>
              setOpenMenuHighlightId((current) =>
                current === highlight.id ? null : highlight.id,
              )
            }
            onMenuClose={() => setOpenMenuHighlightId(null)}
            onDelete={
              onDelete
                ? () => {
                    onDelete(highlight.id);
                    setOpenMenuHighlightId(null);
                  }
                : undefined
            }
            onSelect={onSelect ? () => onSelect(highlight.id) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
