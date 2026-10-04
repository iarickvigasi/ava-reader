import { useHeaderRotation } from "@/features/reader/use-header-rotation";
import { MobileReaderHeaderRow } from "./mobile-reader-header-row";

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
      className="block w-full min-w-0 truncate"
      title={state.chapter ? `${title}, ${chapter}` : book}
    >
      <MobileReaderHeaderRow
        title={title}
        author={author}
        chapter={chapter}
        showChapter={state.chapter}
        fading={state.fading}
      />
    </span>
  );
}
