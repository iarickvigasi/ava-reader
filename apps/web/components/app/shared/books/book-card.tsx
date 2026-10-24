import Link from "next/link";
import { BookCover } from "../book-cover";
import { BookAuthors, type BookAuthor } from "./book-authors";
import { cn } from "@/lib/cn";

export function BookCard({
  title,
  authors,
  href,
  coverImageUrl,
  libraryItemId,
  mobile = false,
  uniformCover = false,
  catalogWorkId,
}: {
  title: string;
  authors: BookAuthor[];
  href: string;
  coverImageUrl: string | null;
  libraryItemId?: string;
  mobile?: boolean;
  uniformCover?: boolean;
  catalogWorkId?: string;
}) {
  return (
    <article
      data-catalog-work={catalogWorkId}
      className={cn(
        "group row-span-2 grid min-w-0 grid-cols-1 grid-rows-subgrid gap-3 shrink-0",
        mobile ? "w-43.5" : "w-full",
      )}
    >
      <Link
        href={href}
        aria-label={title}
        className={cn(
          "flex items-end transition hover:-translate-y-0.5",
          uniformCover && "[container-type:size] aspect-2/3 w-full max-w-61.5",
        )}
      >
        <BookCover
          alt={`${title} cover`}
          fit={uniformCover}
          className={cn(
            "w-full",
            coverImageUrl && "shadow-(--shadow-card)",
            mobile ? "max-w-43.5" : "max-w-61.5",
          )}
          libraryItemId={libraryItemId}
          src={coverImageUrl}
          title={title}
        />
      </Link>
      <div className="space-y-1">
        <Link href={href}>
          <h3 className="line-clamp-2 wrap-anywhere font-display text-xl leading-tight tracking-[-0.03em] text-title transition hover:text-ink md:text-[1.375rem]">
            {title}
          </h3>
        </Link>
        <BookAuthors
          authors={authors}
          className={cn(
            "text-[0.95rem] leading-5 md:text-base",
            uniformCover && "line-clamp-2",
          )}
        />
      </div>
    </article>
  );
}
