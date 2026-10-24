import type { LibraryBookInfo } from "@/lib/api-types";
import { BookTitle } from "@/components/app/shared/books/book-title";
import { BookAuthors } from "@/components/app/shared/books/book-authors";
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
            className="rounded-control bg-paper-strong px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/80"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        <BookTitle>{book.title}</BookTitle>
        <BookAuthors authors={book.authors.map((name) => ({ name }))} />
      </div>
    </div>
  );
}
