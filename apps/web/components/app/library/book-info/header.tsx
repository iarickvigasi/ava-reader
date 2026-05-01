import type { LibraryBookInfo } from "@/lib/api-types";
import { formatAuthors } from "@/lib/format-authors";
import { buildBookTags } from "./formatters";

type BookHeaderProps = {
  book: LibraryBookInfo;
};

export function BookHeader({ book }: BookHeaderProps) {
  const tags = buildBookTags(book);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-[11px] bg-paper-strong px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/80"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        <h1 className="font-display text-[3.2rem] leading-[0.96] tracking-[-0.03em] text-title md:text-[4.6rem]">
          {book.title}
        </h1>
        <p className="font-reader text-xl text-plum md:text-[1.75rem]">
          {formatAuthors(book.authors)}
        </p>
      </div>
    </div>
  );
}
