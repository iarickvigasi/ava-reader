import type { ReaderPackage } from '../reader-types';

// In-process LRU cache for parsed reader packages. Each package can be tens of
// MB once parsed into JS objects; without caching, every chapter navigation
// re-loads the blob from Postgres and reparses the JSON, which spikes memory
// and risks OOM-killing the API process for large books. Keyed by `blobId`,
// which is immutable — a new StoredBlob row is created when the package is
// regenerated (see ReaderProcessingService).
const READER_PACKAGE_CACHE_MAX_ENTRIES = 4;
const readerPackageCache = new Map<string, ReaderPackage>();
// Coalesces concurrent loads for the same blobId so a burst of chapter
// navigations doesn't trigger N parallel multi-MB JSON parses.
const readerPackageLoadsInFlight = new Map<string, Promise<ReaderPackage>>();

export function rememberReaderPackage(
  blobId: string,
  readerPackage: ReaderPackage,
): ReaderPackage {
  // Refresh recency by deleting + reinserting (Map preserves insertion order).
  readerPackageCache.delete(blobId);
  readerPackageCache.set(blobId, readerPackage);
  while (readerPackageCache.size > READER_PACKAGE_CACHE_MAX_ENTRIES) {
    // `Map.keys().next()` types `.value` as `TReturn = any` on the done
    // branch, which trips no-unsafe-assignment. Narrow via `done` instead.
    const oldest = readerPackageCache.keys().next();
    if (oldest.done) {
      break;
    }
    readerPackageCache.delete(oldest.value);
  }
  return readerPackage;
}

export function getCachedReaderPackage(blobId: string): ReaderPackage | null {
  const cached = readerPackageCache.get(blobId);
  if (!cached) {
    return null;
  }
  // Touch for LRU recency.
  readerPackageCache.delete(blobId);
  readerPackageCache.set(blobId, cached);
  return cached;
}

export function getReaderPackageLoadInFlight(
  blobId: string,
): Promise<ReaderPackage> | undefined {
  return readerPackageLoadsInFlight.get(blobId);
}

export function trackReaderPackageLoad(
  blobId: string,
  load: Promise<ReaderPackage>,
) {
  readerPackageLoadsInFlight.set(blobId, load);
}

export function clearReaderPackageLoad(blobId: string) {
  readerPackageLoadsInFlight.delete(blobId);
}

// Test hook — resets the in-process cache so unit tests do not leak parsed
// packages between cases.
export function __resetReaderPackageCacheForTesting() {
  readerPackageCache.clear();
  readerPackageLoadsInFlight.clear();
}
