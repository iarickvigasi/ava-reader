import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { getTranslationBucket, isCurrentTranslationBucket } from "./bucket";
import { ensureSentenceAlignments } from "./align";
import { generateTranslationBatch } from "./generate";
import { nextSentenceBatch, sameTranslationIdentity } from "./selectors";
import { waitForRun } from "./mutations";

export async function regeneratePage(
  chapter: BilingualChapter,
  sentenceIds: string[],
  kind: "translation" | "pairs",
  signal: AbortSignal,
) {
  const bucket = getTranslationBucket(chapter);
  await bucket.hydrated;
  signal.throwIfAborted();
  const previous = [
    bucket.generationRun,
    bucket.alignmentRun,
    bucket.fetchRun,
  ].filter(Boolean);
  for (const run of previous) run!.controller.abort();
  await Promise.all(
    previous.map((run) => waitForRun(run!.promise, signal).catch(() => {})),
  );
  signal.throwIfAborted();
  const current = bucket.snapshot.chapter;
  if (
    !isCurrentTranslationBucket(bucket) ||
    !current ||
    !sameTranslationIdentity(current, chapter)
  )
    return;
  const run = { controller: new AbortController(), promise: Promise.resolve() };
  const abort = () => run.controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  bucket.generationRun = run;
  // IDs are captured at click time; resizing after a new translation must not expand the scope.
  run.promise = (async () => {
    let remaining = [...new Set(sentenceIds)];
    while (remaining.length) {
      run.controller.signal.throwIfAborted();
      const batch = nextSentenceBatch(chapter, remaining).slice(0, 8);
      if (kind === "translation") {
        await generateTranslationBatch(
          bucket,
          chapter,
          batch,
          run.controller.signal,
          true,
        );
      } else {
        await ensureSentenceAlignments(
          chapter,
          batch,
          run.controller.signal,
          true,
        );
      }
      remaining = remaining.filter((id) => !batch.includes(id));
    }
  })().finally(() => {
    signal.removeEventListener("abort", abort);
    if (bucket.generationRun === run) bucket.generationRun = null;
  });
  await run.promise;
}
