"use client";

import { useSearchParams } from "next/navigation";
import { BookCoverPanel } from "@/components/app/library/book-info/cover-panel";
import { formatAuthors } from "@/lib/format-authors";

// Rendered during the navigation to /app/library/books/[slug] before the
// server page resolves. The book card encodes title/authors/coverImageUrl in
// search params on click (see getLibraryBookInfoHref), so we can paint the
// cover and header instantly instead of a generic skeleton. Direct nav or
// refresh has no hints — falls back to a pure skeleton.
export default function LibraryBookInfoLoading() {
  const params = useSearchParams();
  const title = params.get("title");
  const authors = params.getAll("author");
  const coverImageUrl = params.get("cover");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-6 md:pb-14 md:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-12 md:space-y-16">
        <div className="h-4 w-28 animate-pulse rounded bg-paper-strong" />

        <section className="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-12">
          {title ? (
            <BookCoverPanel coverImageUrl={coverImageUrl} title={title} />
          ) : (
            <div className="aspect-2/3 w-full max-w-80 animate-pulse rounded-sm bg-paper-strong md:max-w-96" />
          )}

          <div className="space-y-6">
            <div className="flex gap-2">
              <div className="h-6 w-20 animate-pulse rounded-[11px] bg-paper-strong" />
              <div className="h-6 w-24 animate-pulse rounded-[11px] bg-paper-strong" />
            </div>
            {title ? (
              <div className="space-y-2">
                <h1 className="font-display text-[3.2rem] leading-[0.96] tracking-[-0.03em] text-title md:text-[4.6rem]">
                  {title}
                </h1>
                {authors.length > 0 ? (
                  <p className="font-reader text-xl text-plum md:text-[1.75rem]">
                    {formatAuthors(authors)}
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="h-16 w-3/4 animate-pulse rounded bg-paper-strong" />
                <div className="h-8 w-2/5 animate-pulse rounded bg-paper-strong" />
              </>
            )}
            <div className="h-14 w-64 animate-pulse rounded-[10px] bg-paper-strong" />
            <div className="space-y-3 border-y border-line/45 py-5">
              <div className="h-4 w-48 animate-pulse rounded bg-paper-strong" />
              <div className="h-2 w-full animate-pulse rounded bg-paper-strong" />
              <div className="h-4 w-64 animate-pulse rounded bg-paper-strong" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-paper-strong" />
                  <div className="h-6 w-36 animate-pulse rounded bg-paper-strong" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
