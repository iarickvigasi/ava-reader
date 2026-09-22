import type { ReaderChapterPayload } from "@/lib/api-types";
import { HeaderStatusChip } from "@/components/app/core/header-status-chip";
import type { ReadyReaderPayload } from "../shared/types";
import { formatReaderHeaderParts } from "../shared/utils";

export function ReadyReaderHeader({
  activeChapter,
  payload,
}: {
  activeChapter: ReaderChapterPayload;
  payload: ReadyReaderPayload;
}) {
  const { title, author, chapter } = formatReaderHeaderParts(
    payload,
    activeChapter,
  );

  return (
    <header className="flex min-w-0 flex-1 items-center gap-3 pt-1">
      <h1 className="flex min-w-0 flex-1 items-center gap-1 font-ui text-[1.05rem] leading-[1.35] tracking-[0.01em] text-title sm:text-[1.2rem] md:min-h-9">
        <span className="min-w-0 truncate max-w-[25ch]">{title}</span>

        <span className="shrink-0">,</span>

        <span className="min-w-0 truncate">{author}</span>

        <span className="shrink-0">–</span>

        <span className="min-w-0 truncate" title={chapter}>
          {chapter}
        </span>
      </h1>
      <div className="hidden shrink-0 md:flex">
        <HeaderStatusChip />
      </div>
    </header>
  );
}
