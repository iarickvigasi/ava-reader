import { BilingualPageSkeleton } from "../bilingual/loading/bilingual-page-skeleton";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { cn } from "@/lib/cn";

export function ReaderTextSkeleton() {
  const { isPhone } = useReaderUi();
  return (
    <div
      aria-hidden="true"
      data-reader-text-skeleton
      className={cn(
        "pointer-events-none absolute inset-0 z-10 overflow-hidden bg-paper px-3 py-2",
        !isPhone && "sm:px-5 sm:py-6 md:px-6",
      )}
    >
      <BilingualPageSkeleton />
    </div>
  );
}
