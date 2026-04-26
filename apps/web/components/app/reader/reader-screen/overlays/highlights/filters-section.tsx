import { useState } from "react";
import { ColorFilterChip } from "./highlights-fields";
import {
  SAMPLE_HIGHLIGHT_FILTERS,
  type HighlightFilter,
} from "./highlights-data";

export function FiltersSection() {
  const [activeFilterId, setActiveFilterId] = useState<HighlightFilter["id"]>(
    "all",
  );

  return (
    <section className="flex flex-wrap gap-3">
      {SAMPLE_HIGHLIGHT_FILTERS.map((filter) => (
        <ColorFilterChip
          key={filter.id}
          filter={filter}
          isActive={activeFilterId === filter.id}
          onSelect={() => setActiveFilterId(filter.id)}
        />
      ))}
    </section>
  );
}
