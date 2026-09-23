import type { BilingualChapter } from "@/lib/api-types/bilingual";

import { isOnline } from "../../net/net-state";
import {
  isCurrentTranslationBucket,
  publishTranslationSnapshot,
} from "./bucket";
import { requestTranslation } from "./network";
import { sameTranslationIdentity } from "./selectors";
import { writeTranslationChapter } from "./storage";
import type { TranslationBucket, TranslationRun } from "./types";
import { validateTranslationChapter } from "./validate";
import { validAlignments } from "@/features/reader/bilingual/alignment/validate-alignment";

export function applyTranslationChapter(
  bucket: TranslationBucket,
  chapter: BilingualChapter,
): void {
  if (!isCurrentTranslationBucket(bucket)) return;
  const current = bucket.snapshot.chapter;
  const merged =
    current && sameTranslationIdentity(current, chapter)
      ? {
          ...chapter,
          translations: { ...current.translations, ...chapter.translations },
        }
      : chapter;
  if (current?.alignments || chapter.alignments) {
    merged.alignments = validAlignments(
      {
        ...(current && sameTranslationIdentity(current, chapter)
          ? current.alignments
          : {}),
        ...chapter.alignments,
      },
      merged,
    );
  }
  publishTranslationSnapshot(bucket, {
    chapter: merged,
    status: "ready",
    error: null,
  });
  bucket.pendingPersist = bucket.pendingPersist
    .catch(() => {})
    .then(async () => {
      if (isCurrentTranslationBucket(bucket))
        await writeTranslationChapter(bucket.db, merged);
    })
    .catch(() => {});
}

export function revalidateTranslationChapter(
  bucket: TranslationBucket,
  force = false,
): Promise<void> {
  if (bucket.fetchRun) return bucket.fetchRun.promise;
  if (
    !isCurrentTranslationBucket(bucket) ||
    (!force && bucket.revalidated && isOnline())
  )
    return Promise.resolve();
  bucket.revalidated = false;
  bucket.revalidationError = null;
  const run: TranslationRun = {
    controller: new AbortController(),
    promise: Promise.resolve(),
  };
  bucket.fetchRun = run;
  run.promise = fetchChapter(bucket, run).finally(() => {
    if (bucket.fetchRun === run) bucket.fetchRun = null;
  });
  return run.promise;
}

async function fetchChapter(
  bucket: TranslationBucket,
  run: TranslationRun,
): Promise<void> {
  await bucket.hydrated;
  if (!isCurrentTranslationBucket(bucket) || run.controller.signal.aborted)
    return;
  if (!isOnline()) {
    bucket.revalidated = false;
    publishTranslationSnapshot(bucket, {
      ...bucket.snapshot,
      status: "offline",
      error: null,
    });
    return;
  }
  publishTranslationSnapshot(bucket, {
    ...bucket.snapshot,
    status: bucket.snapshot.chapter ? "ready" : "loading",
    error: null,
  });
  try {
    const suffix = `/chapters/${encodeURIComponent(bucket.scope.chapterId)}?targetLang=${encodeURIComponent(bucket.scope.targetLang)}`;
    const value = await requestTranslation(
      bucket,
      suffix,
      run.controller.signal,
    );
    run.controller.signal.throwIfAborted();
    const chapter = validateTranslationChapter(value, bucket.scope);
    bucket.revalidated = true;
    applyTranslationChapter(bucket, chapter);
  } catch (error) {
    if (run.controller.signal.aborted) return;
    bucket.revalidationError = error;
    publishTranslationSnapshot(bucket, {
      ...bucket.snapshot,
      status: isOnline() ? "error" : "offline",
      error:
        error instanceof Error
          ? error.message
          : "Could not load the translation.",
    });
  }
}
