"use client";

import { useTranslations } from "next-intl";
import { SearchField } from "@/components/app/shared/search-field";
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
        <SearchField
          label={t("searchAria")}
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
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
