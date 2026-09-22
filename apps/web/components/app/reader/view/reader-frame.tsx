import type { ReactNode, RefObject } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { cn } from "@/lib/cn";
import type { ReadyReaderProps } from "../shared/types";
import { ReadyReaderHeader } from "./ready-reader-header";
import { ReadyReaderActivityStatus } from "./ready-reader-activity-status";

type ReaderFrameProps = Pick<
  ReadyReaderProps,
  | "activeChapter"
  | "payload"
  | "isBootstrapping"
  | "isLoadingChapter"
  | "isRefreshingWindow"
> & {
  children: ReactNode;
  rootRef?: RefObject<HTMLDivElement | null>;
  height?: number;
  embedded?: boolean;
};

export function ReaderFrame({
  children,
  rootRef,
  height,
  embedded = false,
  ...props
}: ReaderFrameProps) {
  const { isPhone } = useReaderUi();
  return (
    <div
      ref={rootRef}
      data-reader-frame
      data-reader-phone={isPhone}
      className={cn(
        "h-full",
        !embedded && "px-4 pb-2 pt-2",
        !embedded &&
          !isPhone &&
          "sm:px-6 sm:pb-5 sm:pt-8 md:px-7 md:pt-8 lg:px-8",
      )}
      style={!embedded && height && height > 0 ? { height } : undefined}
    >
      <section className="mx-auto flex h-full max-w-312 min-w-0 flex-col">
        <div
          className={cn(
            "hidden items-start justify-between gap-6",
            !embedded && !isPhone && "sm:flex",
          )}
        >
          <ReadyReaderHeader
            activeChapter={props.activeChapter}
            payload={props.payload}
          />
          <ReadyReaderActivityStatus {...props} />
        </div>
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-0",
            !embedded && !isPhone && "sm:mt-8 sm:gap-4",
          )}
        >
          {children}
        </div>
      </section>
    </div>
  );
}
