import { getActiveUserId, getDb } from "../../db";
import { isOnline } from "../../net/net-state";
import { translationKey } from "./id";
import { readTranslationChapter } from "./storage";
import type {
  TranslationBucket,
  TranslationScope,
  TranslationSnapshot,
} from "./types";

const buckets = new Map<string, TranslationBucket>();
const listeners = new Set<() => void>();
export const EMPTY_TRANSLATION_SNAPSHOT: TranslationSnapshot = {
  chapter: null,
  status: "loading",
  error: null,
};

export function getTranslationBucket(
  scope: TranslationScope,
): TranslationBucket {
  const db = getDb();
  const key = JSON.stringify([db.name, ...translationKey(scope)]);
  const existing = buckets.get(key);
  if (existing) return existing;
  const bucket: TranslationBucket = {
    scope: { ...scope, targetLang: scope.targetLang.trim() },
    db,
    userId: getActiveUserId(),
    disposed: false,
    snapshot: EMPTY_TRANSLATION_SNAPSHOT,
    getToken: null,
    hydrated: Promise.resolve(),
    pendingPersist: Promise.resolve(),
    revalidated: false,
    revalidationError: null,
    fetchRun: null,
    generationRun: null,
  };
  buckets.set(key, bucket);
  bucket.hydrated = hydrate(bucket);
  return bucket;
}

export function isCurrentTranslationBucket(bucket: TranslationBucket): boolean {
  return (
    !bucket.disposed &&
    bucket.userId === getActiveUserId() &&
    bucket.db === getDb()
  );
}

export function publishTranslationSnapshot(
  bucket: TranslationBucket,
  snapshot: TranslationSnapshot,
) {
  if (!isCurrentTranslationBucket(bucket)) return;
  bucket.snapshot = snapshot;
  for (const listener of listeners) listener();
}

export function subscribeToTranslations(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearAllTranslationBuckets(): void {
  for (const bucket of buckets.values()) {
    bucket.disposed = true;
    bucket.fetchRun?.controller.abort();
    bucket.generationRun?.controller.abort();
  }
  buckets.clear();
  for (const listener of listeners) listener();
}

export async function awaitTranslationPersistDrain(): Promise<void> {
  await Promise.all(
    [...buckets.values()].map(async (bucket) => {
      await bucket.hydrated;
      await bucket.fetchRun?.promise.catch(() => {});
      await bucket.generationRun?.promise.catch(() => {});
      await bucket.pendingPersist.catch(() => {});
    }),
  );
}

async function hydrate(bucket: TranslationBucket): Promise<void> {
  try {
    const chapter = await readTranslationChapter(bucket.db, bucket.scope);
    if (bucket.snapshot.chapter) return;
    publishTranslationSnapshot(bucket, {
      chapter,
      status: chapter ? "ready" : isOnline() ? "loading" : "offline",
      error: null,
    });
  } catch {
    // IndexedDB may be unavailable; the bucket still serves this session.
    publishTranslationSnapshot(bucket, {
      ...bucket.snapshot,
      status: isOnline() ? "loading" : "offline",
    });
  }
}
