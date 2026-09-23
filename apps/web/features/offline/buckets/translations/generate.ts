import type { BilingualChapter } from "@/lib/api-types/bilingual";

import { isOnline } from "../../net/net-state";
import {
  isCurrentTranslationBucket,
  publishTranslationSnapshot,
} from "./bucket";
import { requestTranslation } from "./network";
import { sameTranslationIdentity } from "./selectors";
import { applyTranslationChapter } from "./sync";
import type { TranslationBucket } from "./types";
import { validateGeneratedTranslations } from "./validate";

export async function generateTranslationBatch(
  bucket: TranslationBucket,
  chapter: BilingualChapter,
  ids: string[],
  signal: AbortSignal,
  regenerate = false,
): Promise<void> {
  if (!isOnline()) {
    publishTranslationSnapshot(bucket, {
      ...bucket.snapshot,
      status: "offline",
      error: null,
    });
    throw new Error("Go online to translate this page.");
  }
  try {
    const { chapterId, contentRevision, translationVersion, targetLang } =
      chapter;
    const value = await requestTranslation(bucket, "/generate", signal, {
      chapterId,
      contentRevision,
      translationVersion,
      targetLang,
      sentenceIds: ids,
      ...(regenerate ? { regenerate: true } : {}),
    });
    signal.throwIfAborted();
    const result = validateGeneratedTranslations(value, chapter, ids);
    const current = bucket.snapshot.chapter;
    if (
      !isCurrentTranslationBucket(bucket) ||
      !current ||
      !sameTranslationIdentity(current, result)
    )
      return;
    applyTranslationChapter(
      bucket,
      {
        ...current,
        translations: result.translations,
        ...(regenerate
          ? {
              alignments: Object.fromEntries(
                Object.entries(current.alignments ?? {}).filter(
                  ([id]) => !ids.includes(id),
                ),
              ),
            }
          : {}),
      },
      regenerate ? ids : [],
    );
  } catch (error) {
    if (!signal.aborted)
      publishTranslationSnapshot(bucket, {
        ...bucket.snapshot,
        status: isOnline() ? "error" : "offline",
        error:
          error instanceof Error
            ? error.message
            : "Could not translate this page.",
      });
    throw error;
  }
}
