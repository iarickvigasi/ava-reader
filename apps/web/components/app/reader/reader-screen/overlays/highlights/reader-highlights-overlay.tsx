import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ReaderChapterPayload } from "@/lib/api-types";
import { MobileCloseButton } from "../mobile-close-button";
import { PanelTitle } from "../panel-title";
import { useCloseOnEscape } from "../use-close-on-escape";
import { ControlsSection } from "./controls-section";
import { FiltersSection } from "./filters-section";
import { HighlightsListSection } from "./highlights-list-section";
import { HIGHLIGHT_COLOR_ORDER, type HighlightColor } from "./highlights-data";
import { useHighlightsContext } from "./highlights-context";

type ReaderHighlightsOverlayProps = {
  chapters: ReaderChapterPayload[];
  onClose: () => void;
  onSelectHighlight?: (highlightId: string) => void;
};

export function ReaderHighlightsOverlay({
  chapters,
  onClose,
  onSelectHighlight,
}: ReaderHighlightsOverlayProps) {
  useCloseOnEscape(onClose);
  const t = useTranslations("reader.highlights");
  const { highlights, deleteHighlight } = useHighlightsContext();
  const [activeFilterId, setActiveFilterId] = useState<HighlightColor | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const chapterLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const chapter of chapters) {
      map.set(chapter.chapterId, chapter.title);
    }
    return map;
  }, [chapters]);

  const counts = useMemo(() => {
    const result: Record<HighlightColor, number> = {
      apricot: 0,
      mimosa: 0,
      jade: 0,
      sky: 0,
      lavender: 0,
      rose: 0,
      mauve: 0,
    };
    for (const highlight of highlights) {
      result[highlight.color] += 1;
    }
    return result;
  }, [highlights]);

  const visibleHighlights = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    return highlights
      .filter((highlight) =>
        activeFilterId === "all" ? true : highlight.color === activeFilterId,
      )
      .filter((highlight) =>
        trimmedQuery
          ? highlight.excerpt.toLowerCase().includes(trimmedQuery)
          : true,
      )
      // Group by color so the panel reads as "all jade together, then sky,
      // ..." — that's what "aggregated by color" means in the brief.
      .sort((a, b) => {
        if (a.color !== b.color) {
          return (
            HIGHLIGHT_COLOR_ORDER.indexOf(a.color) -
            HIGHLIGHT_COLOR_ORDER.indexOf(b.color)
          );
        }
        return b.createdAt.localeCompare(a.createdAt);
      })
      .map((highlight) => ({
        id: highlight.id,
        text: highlight.excerpt,
        color: highlight.color,
        chapterLabel:
          chapterLabelById.get(highlight.locator?.chapterId ?? "") ??
          t("unknownChapter"),
      }));
  }, [activeFilterId, chapterLabelById, highlights, searchQuery, t]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <HighlightsBackdrop onClose={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-full justify-start md:w-94">
        <div className="relative h-full w-full max-w-[24rem] md:w-94 md:max-w-94">
          <HighlightsBackgroundLayer />
          <div className="relative z-10 flex h-full flex-col md:pt-24">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col px-6 py-8 sm:px-8 md:animate-[reader-contents-enter_320ms_cubic-bezier(0.22,1,0.36,1)_140ms_both] md:px-8 md:py-0">
              <HighlightsHeader onClose={onClose} />
              <HighlightsSections
                activeFilterId={activeFilterId}
                counts={counts}
                onChangeFilter={setActiveFilterId}
                onChangeSearch={setSearchQuery}
                onDelete={deleteHighlight}
                onSelectHighlight={onSelectHighlight}
                searchQuery={searchQuery}
                total={highlights.length}
                visibleHighlights={visibleHighlights}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function HighlightsBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close highlights panel"
      className="pointer-events-auto absolute inset-0 bg-transparent md:left-94"
      onClick={onClose}
    />
  );
}

function HighlightsBackgroundLayer() {
  return (
    <div className="absolute inset-0 border-r border-line/35 bg-linear-to-r from-paper-strong/88 via-paper/78 to-paper/50 shadow-[10px_0_40px_rgba(31,27,24,0.05)] backdrop-blur-[7px] md:hidden" />
  );
}

function HighlightsHeader({ onClose }: { onClose: () => void }) {
  const t = useTranslations("reader.highlights");
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <PanelTitle>{t("title")}</PanelTitle>
      </div>
      <MobileCloseButton ariaLabel={t("closePanel")} onClose={onClose} />
    </div>
  );
}

function HighlightsSections({
  activeFilterId,
  counts,
  onChangeFilter,
  onChangeSearch,
  onDelete,
  onSelectHighlight,
  searchQuery,
  total,
  visibleHighlights,
}: {
  activeFilterId: HighlightColor | "all";
  counts: Record<HighlightColor, number>;
  onChangeFilter: (next: HighlightColor | "all") => void;
  onChangeSearch: (value: string) => void;
  onDelete: (id: string) => void;
  onSelectHighlight?: (id: string) => void;
  searchQuery: string;
  total: number;
  visibleHighlights: Array<{
    id: string;
    text: string;
    color: HighlightColor;
    chapterLabel: string;
  }>;
}) {
  return (
    <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <ControlsSection value={searchQuery} onChange={onChangeSearch} />
      <FiltersSection
        activeFilterId={activeFilterId}
        counts={counts}
        onChange={onChangeFilter}
        total={total}
      />
      <HighlightsListSection
        highlights={visibleHighlights}
        onDelete={onDelete}
        onSelect={onSelectHighlight}
      />
    </div>
  );
}
