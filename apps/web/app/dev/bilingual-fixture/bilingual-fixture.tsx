"use client";

import { useRef } from "react";
import { ReaderNavigation } from "@/components/app/core/app-navigation";
import { ReaderShell } from "@/components/app/core/reader-shell";
import { useReaderUi } from "@/components/app/core/reader-ui-context";
import { useTranslateTargetLang } from "@/components/app/preferences/use-translate-target-lang";
import { ReaderScreen } from "@/components/app/reader/reader-screen";
import { fixturePayload, FIXTURE_ID } from "./fixture-payload";
import { useFixturePhone } from "./use-fixture-phone";
import { useFixtureTranslations } from "./use-fixture-translations";
import { useFixtureColumnMetrics } from "./use-fixture-column-metrics";
import { FixtureArrivalControls } from "./fixture-arrival-controls";

// This fixture adds only its own fake book; it never changes the active user,
// credentials, existing progress, or translation language preference.
export function BilingualFixture() {
  useFixturePhone();
  const { isBilingual } = useReaderUi();
  const [targetLang] = useTranslateTargetLang();
  const rootRef = useRef<HTMLDivElement>(null);
  const fixture = useFixtureTranslations(targetLang);
  const metrics = useFixtureColumnMetrics(rootRef);
  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-40 flex min-h-0 flex-col bg-paper"
      data-fixture-mode={isBilingual ? "bilingual" : "original"}
    >
      <ReaderShell navigation={<ReaderNavigation />}>
        <div className="h-full min-h-0" data-fixture-ready={fixture.ready}>
          {fixture.error ? (
            <p role="alert">{fixture.error}</p>
          ) : fixture.ready ? (
            <ReaderScreen
              initialPayload={fixturePayload}
              libraryItemId={FIXTURE_ID}
              persistenceMode="local-only"
            />
          ) : (
            <p>Preparing fixture cache</p>
          )}
        </div>
      </ReaderShell>
      {fixture.incremental && (
        <FixtureArrivalControls {...fixture} {...metrics} />
      )}
    </div>
  );
}
