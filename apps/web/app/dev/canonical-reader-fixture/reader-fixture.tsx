"use client";
import { useMemo } from "react";
import { ReaderScreen } from "@/components/app/reader/reader-screen";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { Button } from "@/components/ui/button";
import { coldCanonicalFixture } from "@/features/reader/canonical/fixtures/cold-payload";
import { useLockDocumentOverscroll } from "@/components/app/core/use-lock-document-overscroll";

export function CanonicalReaderFixture() {
  const payload = useMemo(() => coldCanonicalFixture(), []);
  const { togglePanel } = useReaderUi();
  useLockDocumentOverscroll(true);
  return (
    <div className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-paper">
      <div className="flex shrink-0 items-center gap-2 px-4 text-sm">
        <span>Authored reader fixture · not an imported book</span>
        <Button
          size="sm"
          variant="soft"
          onClick={() => togglePanel("contents")}
        >
          Contents
        </Button>
        <Button
          size="sm"
          variant="soft"
          onClick={() => togglePanel("preferences")}
        >
          Preferences
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <ReaderScreen
          initialPayload={payload}
          libraryItemId="canonical-reader-fixture"
          persistenceMode="local-only"
        />
      </div>
    </div>
  );
}
