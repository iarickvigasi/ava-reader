import { jumpSelection } from "../state/jump-selection";
import type { ReaderNavigationTarget } from "@/features/reader/navigation";
import type { ReadyReaderProps } from "../shared/types";
import { useReaderJumps } from "../state/use-reader-jumps";
import { ReaderNavigationContext } from "../state/reader-navigation-context";
import { ReaderModeRouter } from "./reader-mode-router";

export function ReaderNavigationState(props: ReadyReaderProps) {
  const navigation = useReaderJumps(props);
  const select = (chapterId: string, target?: ReaderNavigationTarget) => {
    const destination = jumpSelection(
      props.payload.chapters,
      chapterId,
      target,
    );
    if (destination) navigation.jump(destination);
    else
      navigation.setError(
        "That passage could not be located. Your place has been kept.",
      );
  };
  return (
    <div data-reader-navigation className="h-full">
      <ReaderNavigationContext value={navigation}>
        <ReaderModeRouter
          {...props}
          onSelectChapter={select}
          onVisibleLocatorChange={navigation.visibleChanged}
          onTurnChapter={props.onSelectChapter}
        />
      </ReaderNavigationContext>
    </div>
  );
}
