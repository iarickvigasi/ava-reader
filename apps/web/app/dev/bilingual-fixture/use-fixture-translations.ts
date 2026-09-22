import { useCallback, useEffect, useState } from "react";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { getDb } from "@/features/offline/db";
import {
  getTranslationBucket,
  publishTranslationSnapshot,
} from "@/features/offline/buckets/translations/bucket";
import { applyTranslationChapter } from "@/features/offline/buckets/translations/sync";
import { fixtureTranslation } from "./fixture-payload";

// Dev-only harness: operate on the fake book's bucket without changing user identity.
export function useFixtureTranslations(targetLang: string) {
  const [fixture, setFixture] = useState<{
    chapter: BilingualChapter;
    incremental: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrivals, setArrivals] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const incremental =
      new URLSearchParams(window.location.search).get("incremental") === "1";
    const chapter = fixtureTranslation(targetLang);
    const initial = incremental ? { ...chapter, translations: {} } : chapter;
    void getDb()
      .translations.put({ ...initial, fetchedAt: new Date().toISOString() })
      .then(async () => {
        const bucket = getTranslationBucket(initial);
        await bucket.hydrated;
        if (cancelled) return;
        publishTranslationSnapshot(bucket, {
          chapter: initial,
          status: "ready",
          error: null,
        });
        setArrivals(0);
        setRemaining(0);
        setFixture({ chapter, incremental });
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(String(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [targetLang]);

  const publishNext = useCallback(() => {
    if (!fixture || fixture.chapter.targetLang !== targetLang) return;
    const { chapter } = fixture;
    const bucket = getTranslationBucket(chapter);
    const current = bucket.snapshot.chapter?.translations ?? {};
    const next = chapter.units.find(
      (unit) => unit.kind === "sentence" && !current[unit.id],
    );
    if (!next) {
      setRemaining(0);
      return;
    }
    applyTranslationChapter(bucket, {
      ...chapter,
      translations: { [next.id]: chapter.translations[next.id] },
    });
    setArrivals(
      Object.keys(bucket.snapshot.chapter?.translations ?? {}).length,
    );
  }, [fixture, targetLang]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => {
      publishNext();
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [remaining, publishNext]);

  return {
    ready: fixture?.chapter.targetLang === targetLang,
    incremental: fixture?.incremental ?? false,
    error,
    arrivals,
    running: remaining > 0,
    publishNext,
    runArrivals: () => setRemaining(6),
    total: fixture ? Object.keys(fixture.chapter.translations).length : 0,
  };
}
