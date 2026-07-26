"use client";

import { useTranslations } from "next-intl";
import type { ReaderTocNode } from "@/lib/api-types";
import { AiCommentsFiltersSection } from "./ai-comments-filters-section";
import { AiCommentsListSection } from "./ai-comments-list-section";
import { useAiCommentsPanelViewModel } from "./use-ai-comments-panel-view-model";

type AiCommentsSectionsProps = {
  toc: ReaderTocNode[];
  onSelectAiComment?: (id: string) => void;
};

export function AiCommentsSections({
  toc,
  onSelectAiComment,
}: AiCommentsSectionsProps) {
  const {
    activeFilterId,
    setActiveFilterId,
    searchQuery,
    setSearchQuery,
    total,
    counts,
    visibleComments,
    deleteAiComment,
  } = useAiCommentsPanelViewModel(toc);
  const t = useTranslations("reader.aiComments");

  return (
    <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <section>
        <label className="block">
          <span className="sr-only">{t("searchAria")}</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="block h-9 w-full rounded-lg bg-soft-tone-fill px-3 font-ui text-[0.78rem] uppercase tracking-[0.16em] text-muted placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ink/15"
          />
        </label>
      </section>
      <AiCommentsFiltersSection
        activeFilterId={activeFilterId}
        counts={counts}
        onChange={setActiveFilterId}
        total={total}
      />
      <AiCommentsListSection
        comments={visibleComments}
        onDelete={(id) => {
          void deleteAiComment(id);
        }}
        onSelect={onSelectAiComment}
      />
    </div>
  );
}
