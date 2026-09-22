import { BILINGUAL_COLUMN_GAP } from "@/features/reader/bilingual/measurement/use-bilingual-size";
import type { ReadyReaderProps } from "../../shared/types";
import { ReadyReader } from "../../view/ready-reader";
import { BilingualPageSkeleton } from "../loading/bilingual-page-skeleton";

export function BilingualPreparingPage(props: ReadyReaderProps) {
  return (
    <div
      className="grid h-full w-full grid-cols-2"
      style={{ gap: BILINGUAL_COLUMN_GAP }}
    >
      <div className="h-full min-w-0 overflow-hidden">
        <ReadyReader {...props} embedded />
      </div>
      <BilingualPageSkeleton />
    </div>
  );
}
