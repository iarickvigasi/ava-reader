import { cn } from "@/lib/cn";
const CARD_LAYOUT = "row-span-2 grid grid-cols-1 grid-rows-subgrid gap-3";

type BookCardSkeletonProps = {
  mobile?: boolean;
};

export function BookCardSkeleton({ mobile = false }: BookCardSkeletonProps) {
  return (
    <div className={cn(CARD_LAYOUT, "shrink-0", mobile ? "w-43.5" : "w-full")}>
      <div className="flex items-end">
        <div
          className={cn(
            "aspect-2/3 w-full animate-pulse rounded-cover bg-paper-strong",
            mobile ? "max-w-43.5" : "max-w-61.5",
          )}
        />
      </div>
      <div className="space-y-2">
        <div className="h-8 w-4/5 animate-pulse rounded bg-paper-strong" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-paper-strong" />
      </div>
    </div>
  );
}
