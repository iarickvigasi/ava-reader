import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  finishReaderOpeningCover,
  getReaderOpeningCover,
  subscribeReaderOpeningCover,
} from "./reader-opening-cover";

export function useReaderOpeningCover() {
  const pathname = usePathname();
  const opening = useSyncExternalStore(
    subscribeReaderOpeningCover,
    getReaderOpeningCover,
    () => null,
  );
  useEffect(() => {
    if (opening && pathname !== opening.href && pathname !== opening.source)
      finishReaderOpeningCover();
  }, [opening, pathname]);
  return opening;
}
