import type { BookSearchResult } from "@/features/reader/search/types";
import { RowCard } from "../row-card";

export function SearchResultRow({
  result,
  onSelect,
}: {
  result: BookSearchResult;
  onSelect: (result: BookSearchResult) => void;
}) {
  const parts = result.matches.flatMap((match, index) => {
    const before = result.text.slice(
      result.matches[index - 1]?.end ?? 0,
      match.start,
    );
    return [
      before,
      <mark key={match.start} className="bg-(--highlight-mimosa) text-inherit">
        {result.text.slice(match.start, match.end)}
      </mark>,
    ];
  });
  return (
    <RowCard
      group="search-result"
      isMenuOpen={false}
      onMenuClose={() => {}}
      onSelect={() => onSelect(result)}
    >
      <p className="min-w-0 font-display text-[1rem] leading-[1.3] text-title">
        {parts}
        {result.text.slice(result.matches.at(-1)?.end ?? 0)}
      </p>
      <span className="font-ui text-[0.72rem] text-muted">
        {result.chapterLabel}
      </span>
    </RowCard>
  );
}
