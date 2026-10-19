import { ReaderNavigationContext } from "../../state/reader-navigation-context";
import { BilingualPanes } from "./bilingual-panes";
import type { ReadyReaderProps } from "../../shared/types";
import { ReadyReader } from "../../view/ready-reader";
import { BilingualPageSkeleton } from "../loading/bilingual-page-skeleton";

export function BilingualPreparingPage(props: ReadyReaderProps) {
  return (
    <BilingualPanes>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <ReaderNavigationContext value={null}>
          <ReadyReader {...props} embedded />
        </ReaderNavigationContext>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <BilingualPageSkeleton />
      </div>
    </BilingualPanes>
  );
}
