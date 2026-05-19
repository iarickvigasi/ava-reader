"use client";

import type { ReaderTocNode } from "@/lib/api-types";
import { ControlsSection } from "./controls-section";
import { FiltersSection } from "./filters-section";
import { HighlightsListSection } from "./highlights-list-section";
import { useHighlightsPanelViewModel } from "./use-highlights-panel-view-model";

type HighlightsSectionsProps = {
  toc: ReaderTocNode[];
  onSelectHighlight?: (id: string) => void;
};

// Body of the highlights panel: search, color filters, and the aggregated
// list. Owns no chrome — that lives in ReaderHighlightsOverlay. Reads its
// derived state from the view-model hook so the props surface stays small.
export function HighlightsSections({
  toc,
  onSelectHighlight,
}: HighlightsSectionsProps) {
  const {
    activeFilterId,
    setActiveFilterId,
    searchQuery,
    setSearchQuery,
    total,
    counts,
    visibleHighlights,
    deleteHighlight,
  } = useHighlightsPanelViewModel(toc);

  return (
    <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <ControlsSection value={searchQuery} onChange={setSearchQuery} />
      <FiltersSection
        activeFilterId={activeFilterId}
        counts={counts}
        onChange={setActiveFilterId}
        total={total}
      />
      <HighlightsListSection
        highlights={visibleHighlights}
        onDelete={deleteHighlight}
        onSelect={onSelectHighlight}
      />
    </div>
  );
}
