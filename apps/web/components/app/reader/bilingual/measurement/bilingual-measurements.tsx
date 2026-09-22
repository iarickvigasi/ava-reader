import type { RefObject } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderBlock } from "@/lib/api-types";
import { BilingualFlowContent } from "../content/bilingual-flow-content";

export function BilingualMeasurements({
  chapter,
  blocks,
  size,
  measurementRef,
}: {
  chapter: BilingualChapter;
  blocks: ReaderBlock[];
  size: { width: number; height: number };
  measurementRef: RefObject<HTMLDivElement | null>;
}) {
  const unitIndexes = chapter.units.map((_, index) => index);
  return (
    <div
      ref={measurementRef}
      aria-hidden="true"
      inert
      className="pointer-events-none invisible fixed"
      style={{ left: -100000, top: 0, width: size.width }}
    >
      {(["source", "translation"] as const).map((side) => (
        <div key={side} data-natural={side}>
          <BilingualFlowContent
            chapter={chapter}
            blocks={blocks}
            unitIndexes={unitIndexes}
            side={side}
            pageHeight={size.height}
          />
        </div>
      ))}
      <div data-flow-probe />
    </div>
  );
}
