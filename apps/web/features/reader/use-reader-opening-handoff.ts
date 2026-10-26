import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import {
  finishReaderOpeningCover,
  getReaderOpeningCover,
} from "./reader-opening-cover";

export function useReaderOpeningHandoff(ready: boolean) {
  const pathname = usePathname();
  useLayoutEffect(() => {
    if (ready && getReaderOpeningCover()?.href === pathname)
      finishReaderOpeningCover();
  }, [ready, pathname]);
}
