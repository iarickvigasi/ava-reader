import { useState } from "react";
import { HighlightRow } from "./highlight-row";
import type { Highlight } from "./highlights-data";

type HighlightsListSectionProps = {
  highlights: Highlight[];
};

export function HighlightsListSection({
  highlights,
}: HighlightsListSectionProps) {
  const [openMenuHighlightId, setOpenMenuHighlightId] = useState<string | null>(
    null,
  );

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
          />
        </li>
      ))}
    </ul>
  );
}
