import type {
  BilingualChapter,
  BilingualIdentity,
} from "@/lib/api-types/bilingual";
import { validAlignments } from "@/features/reader/bilingual/alignment/validate-alignment";
import { getTranslationBucket, isCurrentTranslationBucket } from "./bucket";
import { requestTranslation } from "./network";
import { waitForRun } from "./mutations";
import { sameTranslationIdentity } from "./selectors";
import { applyTranslationChapter } from "./sync";

export async function ensureSentenceAlignments(
  chapter: BilingualChapter,
  ids: string[],
  signal: AbortSignal,
  regenerate = false,
) {
  const bucket = getTranslationBucket(chapter);
  await bucket.hydrated;
  signal.throwIfAborted();
  if (!isCurrentTranslationBucket(bucket)) return;
  // Only one alignment request per chapter; page navigation cancels its owner.
  while (bucket.alignmentRun) {
    await waitForRun(bucket.alignmentRun.promise, signal).catch(() => {});
    signal.throwIfAborted();
  }
  if (!isCurrentTranslationBucket(bucket)) return;
  const current = bucket.snapshot.chapter;
  if (!current || !sameTranslationIdentity(current, chapter)) return;
  const maps = validAlignments(current.alignments, current);
  const missing = ids.filter(
    (id) => current.translations[id] && (regenerate || !maps[id]),
  );
  if (!missing.length) return;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const run = { controller, promise: Promise.resolve() };
  bucket.alignmentRun = run;
  run.promise = (async () => {
    const { chapterId, contentRevision, translationVersion, targetLang } =
      current;
    const response = (await requestTranslation(
      bucket,
      "/align",
      controller.signal,
      {
        chapterId,
        contentRevision,
        translationVersion,
        targetLang,
        sentenceIds: missing,
        ...(regenerate ? { regenerate: true } : {}),
      },
    )) as BilingualIdentity & { alignments?: unknown };
    controller.signal.throwIfAborted();
    if (!response || !sameTranslationIdentity(response, current))
      throw new Error("Phrase matching did not match this chapter.");
    const alignments = validAlignments(response.alignments, current);
    const latest = bucket.snapshot.chapter;
    if (
      isCurrentTranslationBucket(bucket) &&
      latest &&
      sameTranslationIdentity(latest, current) &&
      Object.keys(alignments).length > 0
    )
      applyTranslationChapter(bucket, {
        ...latest,
        alignments: { ...latest.alignments, ...alignments },
      });
    if (missing.some((id) => !alignments[id]))
      throw new Error("Phrase matching is incomplete. Please retry.");
  })().finally(() => {
    signal.removeEventListener("abort", abort);
    if (bucket.alignmentRun === run) bucket.alignmentRun = null;
  });
  await run.promise;
}
