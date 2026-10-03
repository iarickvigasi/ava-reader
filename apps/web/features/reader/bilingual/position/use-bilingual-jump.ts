import { useEffect, type RefObject } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { RestoreIntent } from "@/features/reader/navigation";
import { useReaderNavigationActions } from "@/components/app/reader/state/reader-navigation-context";
import { settleBilingualJump } from "./settle-bilingual-jump";
export function useBilingualJump(input: {
  sourceRef: RefObject<HTMLElement | null>;
  chapter: BilingualChapter | null;
  intent: RestoreIntent | null;
  ready: boolean;
  pageKey: string;
}) {
  const navigation = useReaderNavigationActions();
  useEffect(() => {
    if (!navigation?.pending || !input.intent || !input.chapter || !input.ready)
      return;
    const frame = requestAnimationFrame(() => {
      const article = input.sourceRef.current;
      if (article)
        navigation.settle(
          input.intent!,
          settleBilingualJump(article, input.chapter!, input.intent!),
        );
    });
    return () => cancelAnimationFrame(frame);
  }, [
    input.sourceRef,
    input.chapter,
    input.intent,
    input.ready,
    input.pageKey,
    navigation,
  ]);
}
