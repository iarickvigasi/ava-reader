import { CATALOG_FILTERS } from "@/features/explore/catalog-filters";

export function ExploreFiltersSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="space-y-5 animate-pulse motion-reduce:animate-none"
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:overflow-hidden">
        {[CATALOG_FILTERS.slice(0, 8), CATALOG_FILTERS.slice(8)].map(
          (row, index) => (
            <div
              key={index}
              className="flex gap-2 overflow-hidden pb-2 sm:contents"
            >
              {row.map((key) => (
                <div
                  key={key}
                  className="h-10 w-32 shrink-0 rounded-full bg-paper-strong"
                />
              ))}
            </div>
          ),
        )}
      </div>
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="mr-2 h-3 w-12 shrink-0 rounded bg-paper-strong" />
        {[0, 1, 2, 3].map((key) => (
          <div
            key={key}
            className="h-10 w-24 shrink-0 rounded-full bg-paper-strong"
          />
        ))}
      </div>
    </div>
  );
}
