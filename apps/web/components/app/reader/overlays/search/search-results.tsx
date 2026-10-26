import { PanelPlaceholder } from "../panel-placeholder";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { BookSearchResult } from "@/features/reader/search/types";
import { SearchResultRow } from "./search-result-row";

const RESULT_BATCH_SIZE = 50;
export function SearchResults({
  results,
  onSelect,
  emptyLabel,
}: {
  results: BookSearchResult[];
  emptyLabel: string;
  onSelect: (result: BookSearchResult) => void;
}) {
  const [limit, setLimit] = useState(RESULT_BATCH_SIZE);
  const t = useTranslations("reader.search");
  if (!results.length) return <PanelPlaceholder>{emptyLabel}</PanelPlaceholder>;
  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-8 pr-2">
      {results.slice(0, limit).map((result) => (
        <SearchResultRow key={result.id} result={result} onSelect={onSelect} />
      ))}
      {results.length > limit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLimit(limit + RESULT_BATCH_SIZE)}
        >
          {t("more")}
        </Button>
      )}
    </div>
  );
}
