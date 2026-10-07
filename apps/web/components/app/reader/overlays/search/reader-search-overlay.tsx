import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type {
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types/reader";
import { useReaderSearch } from "@/features/reader/search/use-reader-search";
import { MAX_SEARCH_QUERY } from "@/features/reader/search/types";
import { searchExcerpt } from "@/features/reader/search/find";
import { PanelTitle } from "../panel-title";
import { useCloseOnEscape } from "../use-close-on-escape";

export function ReaderSearchOverlay({
  payload,
  onClose,
  onSelect,
}: {
  payload: Extract<ReaderStatusPayload, { status: "READY" }>;
  onClose: () => void;
  onSelect: (locator: ReaderLocator) => void;
}) {
  const t = useTranslations("reader.search");
  const search = useReaderSearch(payload);
  const input = useRef<HTMLInputElement>(null);
  useCloseOnEscape(onClose);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const status = search.error
    ? t("unavailable")
    : search.loading || search.pending
      ? t("loading")
      : !search.query.trim()
        ? t("hint")
        : search.results.truncated
          ? t("limited", { count: search.results.hits.length })
          : t("count", { count: search.results.hits.length });
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("close")}
        className="pointer-events-auto absolute inset-0 bg-transparent md:left-94"
        onClick={onClose}
      />
      <aside
        aria-label={t("title")}
        className="pointer-events-auto absolute inset-y-0 left-0 flex w-full max-w-96 flex-col bg-paper/95 px-6 py-8 shadow-lg backdrop-blur-sm md:w-94 md:pt-24"
      >
        <div className="flex items-center justify-between gap-4">
          <PanelTitle>{t("title")}</PanelTitle>
          <button
            type="button"
            data-reader-initial-focus
            aria-label={t("close")}
            onClick={onClose}
            className="size-11 shrink-0 rounded-control text-xl text-ink hover:bg-soft-tone-fill focus-visible:ring-2 focus-visible:ring-line-strong"
          >
            ×
          </button>
        </div>
        <label className="mt-4 block">
          <span className="sr-only">{t("query")}</span>
          <input
            ref={input}
            type="search"
            value={search.query}
            onChange={(event) => search.setQuery(event.target.value)}
            maxLength={MAX_SEARCH_QUERY}
            placeholder={t("query")}
            className="h-11 w-full rounded-control bg-soft-tone-fill px-3 text-copy outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
          />
        </label>
        <p role="status" className="mt-3 text-sm text-muted">
          {status}
        </p>
        {search.error && (
          <button
            type="button"
            onClick={search.retry}
            className="mt-3 rounded-control px-3 py-2 text-copy hover:bg-soft-tone-fill focus-visible:ring-2 focus-visible:ring-line-strong"
          >
            {t("retry")}
          </button>
        )}
        <ul
          className="mt-3 min-h-0 flex-1 overflow-auto"
          aria-busy={search.loading || search.pending}
        >
          {!search.loading &&
            !search.error &&
            !search.pending &&
            search.results.hits.map((hit) => {
              const excerpt = searchExcerpt(hit);
              return (
                <li key={`${hit.chapterId}:${hit.blockId}:${hit.textOffset}`}>
                  <button
                    type="button"
                    onClick={() =>
                      onSelect({
                        chapterId: hit.chapterId,
                        blockId: hit.blockId,
                        textOffset: hit.textOffset,
                      })
                    }
                    className="my-1 w-full rounded-control px-2 py-3 text-left text-copy hover:bg-soft-tone-fill focus-visible:ring-2 focus-visible:ring-line-strong"
                  >
                    <span className="mb-1 block font-ui text-xs text-muted">
                      {hit.chapterLabel}
                    </span>
                    <span className="block break-words font-reader text-base">
                      {excerpt.before}
                      <mark className="rounded-sm bg-soft-tone-fill font-semibold text-ink">
                        {excerpt.match}
                      </mark>
                      {excerpt.after}
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
      </aside>
    </div>
  );
}
