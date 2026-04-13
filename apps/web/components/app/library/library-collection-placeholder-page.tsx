import { cn } from "@/lib/cn";

export function LibraryCollectionPlaceholderPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-5 pb-10 pt-6 sm:px-6 md:pb-14 md:pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-8 md:space-y-10">
        <section className="space-y-4">
          <div className="h-4 w-28 animate-pulse rounded bg-paper-strong" />

          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
              <div className="h-10 w-64 max-w-full animate-pulse rounded bg-paper-strong" />
              <div className="h-4 w-36 animate-pulse rounded bg-paper-strong sm:mb-1" />
            </div>
            <div className="h-5 w-full max-w-3xl animate-pulse rounded bg-paper-strong" />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <CollectionBookCardSkeleton key={index} />
          ))}
        </div>

        <div className="hidden gap-x-8 gap-y-6 md:grid md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <CollectionBookCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CollectionBookCardSkeleton({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={cn("shrink-0", mobile ? "w-43.5" : "w-full")}>
      <div className="space-y-3">
        <div
          className={cn(
            "aspect-[0.666] w-full animate-pulse rounded-[3px] bg-paper-strong",
            mobile ? "max-w-43.5" : "max-w-61.5",
          )}
        />
        <div className="space-y-2">
          <div className="h-8 w-4/5 animate-pulse rounded bg-paper-strong" />
          <div className="h-5 w-2/3 animate-pulse rounded bg-paper-strong" />
        </div>
      </div>
    </div>
  );
}
