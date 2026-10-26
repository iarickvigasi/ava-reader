import { useTranslations } from "next-intl";
import { SearchField } from "@/components/app/shared/search-field";
import { useBookSearch } from "@/features/reader/search/use-book-search";
import { useSearchContent } from "@/features/reader/search/use-search-content";
import type { BookSearchResult } from "@/features/reader/search/types";
import type { ReadyReaderProps } from "../../shared/types";
import { useCloseOnEscape } from "../use-close-on-escape";
import { SearchPanelShell } from "./search-panel-shell";
import { SearchResults } from "./search-results";

export function ReaderSearchOverlay({
  reader,
  query,
  onQueryChange,
  onClose,
  onSelect,
}: {
  reader: ReadyReaderProps;
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (result: BookSearchResult) => void;
}) {
  const t = useTranslations("reader.search");
  useCloseOnEscape(onClose);
  const content = useSearchContent(
    reader.libraryItemId,
    reader.payload.toc,
    reader.payload.chapters,
  );
  const { results, pending } = useBookSearch(content.chapters, query, true);
  const status = content.error
    ? t("error")
    : !query.trim()
      ? t("resultsPlaceholder")
      : pending
        ? t("searching")
        : results.length
          ? t("count", { count: results.length })
          : t("empty");
  return (
    <SearchPanelShell onClose={onClose}>
      <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
        <div className="flex items-center gap-2">
          <SearchField
            className="min-w-0 flex-1"
            label={t("field")}
            placeholder={t("field")}
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <div role="status" className="sr-only">
          {status}
          {!content.complete && !content.error && t("partial")}
        </div>
        <div className="h-5 shrink-0">
          {!content.error && !pending && query.trim() && results.length > 0 && (
            <p className="font-ui text-[0.78rem] uppercase leading-5 tracking-[0.16em] text-muted">
              {t("count", { count: results.length })}
            </p>
          )}
        </div>
        <SearchResults
          key={query}
          results={results}
          onSelect={onSelect}
          emptyLabel={status}
        />
      </div>
    </SearchPanelShell>
  );
}
