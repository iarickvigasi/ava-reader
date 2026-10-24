import { ScreenContainer } from "@/components/ui/screen-container";
import { BookCardSkeleton } from "@/components/app/shared/books/book-card-skeleton";
import { ExploreFiltersSkeleton } from "./explore-filters-skeleton";
import {
  EXPLORE_GRID_CLASS_NAME,
  EXPLORE_SCREEN_CLASS_NAME,
} from "./explore-layout";

export function ExploreScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <ScreenContainer className={EXPLORE_SCREEN_CLASS_NAME}>
        <div
          aria-hidden="true"
          className="max-w-3xl space-y-5 animate-pulse motion-reduce:animate-none"
        >
          <div className="h-4 w-24 rounded bg-paper-strong" />
          <div className="h-20 w-full rounded-control bg-paper-strong sm:h-12 sm:w-4/5" />
          <div className="max-w-2xl space-y-4">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="h-4 w-full rounded bg-paper-strong" />
            ))}
            <div className="h-4 w-2/3 rounded bg-paper-strong sm:hidden" />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="h-10 w-full animate-pulse rounded-control bg-paper-strong motion-reduce:animate-none sm:max-w-xl"
        />
        <ExploreFiltersSkeleton />
        <div aria-hidden="true" className={EXPLORE_GRID_CLASS_NAME}>
          {Array.from({ length: 10 }, (_, index) => (
            <BookCardSkeleton key={index} />
          ))}
        </div>
      </ScreenContainer>
    </div>
  );
}
