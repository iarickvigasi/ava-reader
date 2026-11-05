import { useHeaderWidths } from "@/features/reader/use-header-widths";

export function MobileReaderHeaderText({
  title,
  author,
  chapter,
}: {
  title: string;
  author?: string;
  chapter: string;
}) {
  const { rowRef, measureRef, widths } = useHeaderWidths({
    title,
    author,
    chapter,
  });
  const label = [title, author, chapter].filter(Boolean).join(" – ");
  return (
    <span
      ref={rowRef}
      aria-hidden="true"
      title={label}
      className="relative flex w-full min-w-0 items-baseline gap-1"
    >
      <span
        ref={measureRef}
        className="invisible absolute flex w-max gap-1 whitespace-nowrap"
      >
        <span data-field="title">{title}</span>
        {author && <span data-field="author">, {author}</span>}
        {chapter && (
          <>
            <span>–</span>
            <span data-field="chapter">{chapter}</span>
          </>
        )}
      </span>
      <span
        className="min-w-0 shrink-0 truncate"
        style={{ maxWidth: widths.title }}
      >
        {title}
      </span>
      {author && (
        <span
          className="min-w-0 shrink-0 truncate"
          style={{ maxWidth: widths.author }}
        >
          , {author}
        </span>
      )}
      {chapter && (
        <>
          <span className="shrink-0">–</span>
          <span
            className="min-w-0 truncate"
            style={{ maxWidth: widths.chapter }}
          >
            {chapter}
          </span>
        </>
      )}
    </span>
  );
}
