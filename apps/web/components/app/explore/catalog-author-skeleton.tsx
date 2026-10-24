import { ScreenContainer } from "@/components/ui/screen-container";
import { BookCardSkeleton } from "@/components/app/shared/books/book-card-skeleton";

export function CatalogAuthorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading author details">
      <ScreenContainer className="gap-8 py-10 sm:py-16">
        <div
          aria-hidden="true"
          className="space-y-8 animate-pulse motion-reduce:animate-none"
        >
          <div className="h-3 w-28 rounded bg-paper-strong" />
          <div className="h-20 w-3/4 max-w-xl rounded bg-paper-strong" />
          <div className="max-w-[65ch] space-y-3">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="h-5 rounded bg-paper-strong" />
            ))}
          </div>
          <div className="h-9 w-48 rounded bg-paper-strong" />
        </div>
        <section
          aria-hidden="true"
          className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4"
        >
          {[0, 1, 2, 3].map((key) => (
            <BookCardSkeleton key={key} />
          ))}
        </section>
      </ScreenContainer>
    </div>
  );
}
