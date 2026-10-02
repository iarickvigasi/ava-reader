import { useHeaderRotation } from "@/features/reader/use-header-rotation";
import { HEADER_FADE_MS } from "@/features/reader/header-rotation";
import { cn } from "@/lib/cn";

export function MobileReaderHeaderText({
  title,
  author,
  chapter,
}: {
  title: string;
  author?: string;
  chapter: string;
}) {
  const state = useHeaderRotation();
  const book = [title, author].filter(Boolean).join(", ");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block w-full min-w-0 truncate transition-opacity ease-out motion-reduce:transition-none",
        state.fading ? "opacity-0" : "opacity-100",
      )}
      style={{ transitionDuration: `${HEADER_FADE_MS}ms` }}
      title={state.chapter ? chapter : book}
    >
      {state.chapter ? (
        chapter
      ) : (
        <span className="flex min-w-0 items-baseline">
          <span className="min-w-0 truncate">{title}</span>
          {author && (
            <>
              <span className="shrink-0 whitespace-pre">{", "}</span>
              <span className="max-w-[40%] shrink-0 truncate">{author}</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
