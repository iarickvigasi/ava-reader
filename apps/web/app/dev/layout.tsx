import type { ReactNode } from "react";
import { ReaderUiProvider } from "@/components/app/core/reader-ui-context";

// Dev fixture routes render the reader outside AppShell, which is where the
// reader's panel state normally comes from — without this the fixture throws
// "useReaderUi must be used within a ReaderUiProvider" before it paints.
// The viewport box matches AppShell's reader branch so pagination measures the
// same page size it would in the real reader.
export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <ReaderUiProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </ReaderUiProvider>
  );
}
