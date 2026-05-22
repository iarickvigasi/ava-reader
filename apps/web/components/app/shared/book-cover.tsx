import { cn } from "@/lib/cn";

// The fallback is rendered absolutely behind the <img>. While the image is
// loading, the <img> element has no visible content (transparent) and the
// fallback shows through; once the image is decoded the browser paints it
// on top. No opacity transition, no state — so cached images render in the
// same frame as mount (avoids the flicker that an opacity-0 → opacity-100
// fade introduced when the book-info loading skeleton swapped to the
// rendered page).
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
  if (!src) {
    return <BookCoverFallback className={className} title={title} />;
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-line/40 bg-white/60",
        className,
      )}
    >
      <BookCoverFallback
        className="absolute inset-0 size-full rounded-none border-0"
        title={title}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        className="relative size-full object-cover"
        src={src}
      />
    </div>
  );
}

function BookCoverFallback({
  className,
  title,
}: {
  className?: string;
  title: string;
}) {
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
