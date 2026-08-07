import { cn } from "@/lib/cn";

// The designed stand-in for a cover we can't paint: no src, or a load failure.
// Sizing, ratio and radius come from the <BookCover> frame — this only fills it.
export function BookCoverFallback({
  className,
  title,
}: {
  className?: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center p-4 text-center",
        "bg-soft-fill",
        className,
      )}
    >
      <div className="mx-auto max-w-44">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-olive">
          AVA Reader
        </p>
        <p className="mt-2 font-display text-2xl leading-tight text-title">
          {title}
        </p>
      </div>
    </div>
  );
}
