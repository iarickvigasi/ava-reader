"use client";
import { useMemo, useEffect, useState } from "react";
import { ReaderScreen } from "@/components/app/reader/reader-screen";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { useTranslateTargetLang } from "@/components/app/preferences/use-translate-target-lang";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { Button } from "@/components/ui/button";
import { coldCanonicalFixture } from "@/features/reader/canonical/fixtures/cold-payload";
import { useLockDocumentOverscroll } from "@/components/app/core/use-lock-document-overscroll";
import { seedBilingualFixture } from "./seed";
export function BilingualFixture() {
  const payload = useMemo(() => coldCanonicalFixture(), []);
  const [targetLang] = useTranslateTargetLang();
  const { userId } = useOfflineAuth();
  const { togglePanel, toggleBilingual, isBilingual } = useReaderUi();
  const [prepared, setPrepared] = useState("");
  const key = `${userId}:${targetLang}`;
  useLockDocumentOverscroll(true);
  useEffect(() => {
    let cancelled = false;
    void seedBilingualFixture(payload, targetLang).then(() => {
      if (!cancelled) setPrepared(key);
    });
    return () => {
      cancelled = true;
    };
  }, [payload, targetLang, key]);
  return (
    <div className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-paper">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 text-sm">
        <span>
          Authored bilingual fixture · test text, no model or imported book
        </span>
        <Button size="sm" variant="soft" onClick={toggleBilingual}>
          {isBilingual ? "Original" : "Bilingual"}
        </Button>
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
        {prepared === key ? (
          <ReaderScreen
            initialPayload={payload}
            libraryItemId="canonical-reader-fixture"
            persistenceMode="local-only"
          />
        ) : (
          <p>Preparing authored cache…</p>
        )}
      </div>
    </div>
  );
}
