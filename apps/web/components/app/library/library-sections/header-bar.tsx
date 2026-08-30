import type { LibraryPayload } from "@/lib/api-types";
import { cn } from "@/lib/cn";
import { LibraryHeaderBarDesktop } from "./header-bar-desktop";
import { LibraryHeaderBarMobile } from "./header-bar-mobile";
import { SummaryMetricSkeleton } from "./summary-metric";

export function LibraryHeaderBar({
  summary,
}: {
  summary: LibraryPayload["summary"];
}) {
  return (
    <section>
      <LibraryHeaderBarMobile summary={summary} />
      <LibraryHeaderBarDesktop summary={summary} />
    </section>
  );
}

// One markup for both layouts: placeholders carry no meaning, so the phone's
// metric/button rows and the desktop bar are the same boxes rearranged.
export function LibraryHeaderBarSkeleton() {
  return (
    <section>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
        <div className="h-10 w-full animate-pulse rounded-control bg-paper-strong md:w-88 md:max-w-88 md:shrink-0" />

        <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-6 md:flex md:gap-10">
          <ButtonSkeleton className="w-34 md:hidden" />
          <SummaryMetricSkeleton />
          <ButtonSkeleton className="w-34 md:hidden" />
          <SummaryMetricSkeleton />
        </div>

        <div className="ml-auto hidden md:flex md:items-center md:gap-3">
          <ButtonSkeleton className="w-40" />
          <ButtonSkeleton className="w-34" />
        </div>
      </div>
    </section>
  );
}

// Width comes from the call site: cn() is a plain join, so a default width here
// would still emit alongside an override (styles.md).
function ButtonSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-10 animate-pulse rounded-control bg-paper-strong",
        className,
      )}
    />
  );
}
