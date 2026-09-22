import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useReaderUi } from "./reader-ui-context";

export function ReaderShell({
  navigation,
  children,
}: {
  navigation: ReactNode;
  children: ReactNode;
}) {
  const { isPhone, isBilingual } = useReaderUi();
  return (
    <div
      className={cn(
        "flex h-dvh overflow-hidden",
        isPhone && isBilingual ? "flex-row" : "flex-col",
      )}
    >
      {navigation}
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}
