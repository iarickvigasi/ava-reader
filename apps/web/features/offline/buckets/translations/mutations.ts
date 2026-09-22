import type { BilingualChapter } from "@/lib/api-types/bilingual";

import { getTranslationBucket, isCurrentTranslationBucket } from "./bucket";
import { generateTranslationBatch } from "./generate";
import {
  missingSentenceIds,
  nextSentenceBatch,
  sameTranslationIdentity,
} from "./selectors";
import { revalidateTranslationChapter } from "./sync";
import type { TranslationRun } from "./types";

// Demand lives only for this call. Navigation aborts it; nothing is queued on disk.
export async function ensureSentenceTranslations(
  chapter: BilingualChapter,
  sentenceIds: string[],
  signal?: AbortSignal,
): Promise<void> {
  const bucket = getTranslationBucket(chapter);
  await bucket.hydrated;
  while (isCurrentTranslationBucket(bucket)) {
    signal?.throwIfAborted();
    const current = bucket.snapshot.chapter;
    if (!current || !sameTranslationIdentity(current, chapter)) return;
    const missing = missingSentenceIds(current, sentenceIds);
    if (!missing.length) return;
    if (!bucket.revalidated || bucket.fetchRun) {
      await waitForRun(revalidateTranslationChapter(bucket), signal);
      signal?.throwIfAborted();
      if (!isCurrentTranslationBucket(bucket)) return;
      if (!bucket.revalidated)
        throw (
          bucket.revalidationError ??
          new Error(
            "Go online to load saved translations before translating this page.",
          )
        );
      // GET hydrates the complete saved chapter; recalculate misses from its result.
      continue;
    }
    if (bucket.generationRun) {
      try {
        await waitForRun(bucket.generationRun.promise, signal);
      } catch (error) {
        if (
          signal?.aborted ||
          !(error instanceof DOMException && error.name === "AbortError")
        )
          throw error;
      }
      continue;
    }
    const batch = nextSentenceBatch(current, missing);
    const run: TranslationRun = {
      controller: new AbortController(),
      promise: Promise.resolve(),
    };
    const abort = () => run.controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    bucket.generationRun = run;
    run.promise = generateTranslationBatch(
      bucket,
      current,
      batch,
      run.controller.signal,
    ).finally(() => {
      signal?.removeEventListener("abort", abort);
      if (bucket.generationRun === run) bucket.generationRun = null;
    });
    await run.promise;
  }
}

function waitForRun(
  promise: Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () =>
      reject(new DOMException("The request was aborted.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
