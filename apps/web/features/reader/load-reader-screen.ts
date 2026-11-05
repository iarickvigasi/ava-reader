import {
  fetchReaderPayload,
  type ReaderAuthInput,
} from "@/components/app/reader/data/reader-client";
import { loadReaderPayloadFromCache } from "@/features/offline/buckets/book";
import { isOnline } from "@/features/offline/net/net-state";
import { slugFromPath } from "@/lib/app-routes";
import {
  loadReaderForSlug,
  type ReaderLoadResult,
} from "./load-reader-for-slug";
import { resolveCachedLibraryItemId } from "./resolve-cached-library-item-id";
import { waitForReaderAuth } from "./wait-for-reader-auth";

const READER_PATH_PREFIX = "/app/read/";

export async function loadReaderScreen({
  pathname,
  readAuth,
  signal,
}: {
  pathname: string;
  readAuth: () => ReaderAuthInput;
  signal: AbortSignal;
}): Promise<ReaderLoadResult> {
  signal.throwIfAborted();
  const slug = slugFromPath(pathname, READER_PATH_PREFIX);
  if (!slug) return { kind: "not-found" };

  return loadReaderForSlug(slug, {
    isOnline,
    findLibraryItemIdBySlug: resolveCachedLibraryItemId,
    loadFromCache: loadReaderPayloadFromCache,
    fetchFromNetwork: async (libraryItemId) => {
      const auth = await waitForReaderAuth(readAuth, signal);
      signal.throwIfAborted();
      return fetchReaderPayload({ ...auth, libraryItemId, signal });
    },
  });
}
