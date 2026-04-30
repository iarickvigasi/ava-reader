import type { LibraryBookInfo } from "@/lib/api-types";
import { buildProgressLabel, clampPercent } from "./formatters";

type ReadingProgressProps = {
  book: LibraryBookInfo;
};

export function ReadingProgress({ book }: ReadingProgressProps) {
  const progressPercent = clampPercent(book.completionPercent);
  const progressLabel = buildProgressLabel(book);

  return (
    <section className="space-y-3 border-t border-line/45 py-5">
      <div className="flex items-end justify-between gap-4">
        <p className="text-[0.63rem] font-semibold uppercase tracking-[0.18em] text-muted">
          Reading progress
        </p>
        <p className="font-reader text-lg text-ink">
          {progressPercent}% completed
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand/70">
        <div
          className="h-full rounded-full bg-brand-fill transition-[width] duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-sm italic text-olive">{progressLabel}</p>
    </section>
  );
}
