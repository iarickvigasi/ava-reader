"use client";

import type { ReaderChapterPayload } from "@/lib/api-types";
import { ControlsSection } from "./controls-section";
import { FiltersSection } from "./filters-section";
import { HighlightsListSection } from "./highlights-list-section";
import { useHighlightsPanelViewModel } from "./use-highlights-panel-view-model";

type HighlightsSectionsProps = {
  chapters: ReaderChapterPayload[];
  onSelectHighlight?: (id: string) => void;
};

// Body of the highlights panel: search, color filters, and the aggregated
// list. Owns no chrome — that lives in ReaderHighlightsOverlay. Reads its
// derived state from the view-model hook so the props surface stays small.
export function HighlightsSections({
  chapters,
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
  } = useHighlightsPanelViewModel(chapters);

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
