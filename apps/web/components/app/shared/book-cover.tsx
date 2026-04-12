import { cn } from "@/lib/cn";

export function BookCover({
  alt,
  className,
  src,
  title,
}: {
  alt: string;
  className?: string;
  src: string | null;
  title: string;
}) {
  if (src) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-md border border-line/40 bg-white/60",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={alt} className="size-full object-cover" src={src} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-md border border-line/40 bg-soft-fill p-4 text-center",
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
