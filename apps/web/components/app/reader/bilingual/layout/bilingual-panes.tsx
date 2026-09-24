import type { ComponentProps } from "react";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import {
  BILINGUAL_COLUMN_GAP,
  BILINGUAL_PANE_GAP,
} from "@/features/reader/bilingual/measurement/bilingual-pane-size";

export function BilingualPanes({ children, ...props }: ComponentProps<"div">) {
  const { isPhone } = useReaderUi();
  return (
    <div
      {...props}
      className="relative flex h-full min-h-0 w-full"
      style={{
        flexDirection: isPhone ? "column" : "row",
        gap: isPhone ? BILINGUAL_PANE_GAP : BILINGUAL_COLUMN_GAP,
        touchAction: "none",
      }}
    >
      {children}
      {isPhone && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-line"
        />
      )}
    </div>
  );
}
