import { useHeaderOverflow } from "@/features/reader/use-header-overflow";
import { HEADER_FADE_MS } from "@/features/reader/header-rotation";
import { cn } from "@/lib/cn";

export function MobileReaderHeaderRow({
  title,
  author,
  chapter,
  showChapter,
  fading,
}: {
  title: string;
  author?: string;
  chapter: string;
  showChapter: boolean;
  fading: boolean;
}) {
  const { rowRef, measureRef, overflowing } = useHeaderOverflow();
  return (
    <span ref={rowRef} className="relative block min-w-0">
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute flex w-max gap-2 whitespace-nowrap"
      >
        <span>{title}</span>
        <span>{chapter}</span>
      </span>
      <span
        className={cn(
          "min-w-0 items-baseline",
          showChapter
            ? overflowing
              ? "grid grid-cols-[60%_40%]"
              : "grid grid-cols-[max-content_max-content]"
            : "flex",
        )}
      >
        <span className={cn("min-w-0 truncate", showChapter && "pr-2")}>
          {title}
        </span>
        <span
          className={cn(
            "flex min-w-0 transition-opacity ease-out motion-reduce:transition-none",
            !showChapter && "max-w-[40%] shrink-0",
            fading ? "opacity-0" : "opacity-100",
          )}
          style={{ transitionDuration: `${HEADER_FADE_MS}ms` }}
        >
          {!showChapter && author && (
            <span className="shrink-0 whitespace-pre">{", "}</span>
          )}
          <span className="min-w-0 truncate">
            {showChapter ? chapter : author}
          </span>
        </span>
      </span>
    </span>
  );
}
