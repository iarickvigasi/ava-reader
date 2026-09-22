import type { RefObject } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderBlock } from "@/lib/api-types";
import type {
  BilingualPage,
  MeasuredBilingualUnit,
} from "@/features/reader/bilingual/types";
import { bilingualColumnStyle } from "@/features/reader/bilingual/measurement/column-style";
import { BilingualFlowContent } from "../content/bilingual-flow-content";

const INK_BLEED_PX = 6;

export function BilingualPageColumn({
  chapter,
  blocks,
  page,
  units,
  size,
  side,
  columnRef,
  lang,
  isIosSelection = false,
}: {
  chapter: BilingualChapter;
  blocks: ReaderBlock[];
  page: BilingualPage;
  units: MeasuredBilingualUnit[];
  size: { width: number; height: number };
  side: "source" | "translation";
  columnRef?: RefObject<HTMLElement | null>;
  lang?: string;
  isIosSelection?: boolean;
}) {
  const continuation = page.continuationIndex;
  const first = units[page.unitIndexes[0]];
  const pageCount =
    side === "source"
      ? first?.sourcePageCount
      : (first?.translationPageCount ?? first?.sourcePageCount);
  const blank = continuation !== undefined && continuation >= (pageCount ?? 1);
  return (
    <article
      ref={columnRef}
      lang={lang}
      dir="auto"
      data-bilingual-column={side}
      className={`h-full min-w-0 ${isIosSelection ? "select-none" : ""}`}
      style={{ width: size.width, clipPath: `inset(-${INK_BLEED_PX}px)` }}
    >
      {!blank && (
        <div
          style={
            continuation === undefined
              ? undefined
              : bilingualColumnStyle(size.width, size.height, continuation)
          }
        >
          <BilingualFlowContent
            chapter={chapter}
            blocks={blocks}
            unitIndexes={page.unitIndexes}
            side={side}
            pageHeight={size.height}
          />
        </div>
      )}
    </article>
  );
}
