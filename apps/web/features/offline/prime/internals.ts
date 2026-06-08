// Real implementations behind the primer's seams. Kept separate from the
// orchestrator so the control flow stays Dexie/Clerk-free and testable.

import { readHome } from "../buckets/home/storage";
import { revalidateHome } from "../buckets/home/revalidate";
import { readBookInfo } from "../buckets/library/bucket";
import {
  revalidateBookInfo,
  revalidateCollection,
  revalidateLibrary,
} from "../buckets/library/revalidate";
import { readLibraryView } from "../buckets/library/storage";
import { revalidatePreferences } from "../buckets/preferences/revalidate";
import { revalidateHighlights } from "../buckets/highlights/revalidate";
import { revalidateAiComments } from "../buckets/ai-comments/revalidate";
import { hasInFlightSaves } from "../buckets/book/bucket";
import { checkStorageQuota } from "../buckets/book/quota";
import { hasBookContent } from "../buckets/book/storage";
import { isOnline } from "../net-state";

import { getMetaFlag, hasMetaFlag, setMetaFlag } from "./meta";
import { canPrimeMetadata, isSaveDataOn } from "./should-prime";
import type { PrimeInternals } from "./types";

export const DEFAULT_INTERNALS: PrimeInternals = {
  canPrimeMetadata,
  isSaveDataOn,
  isOnline,
  hasInFlightSaves,
  readLibraryView,
  readHome,
  readBookInfo,
  revalidateHome,
  revalidateLibrary,
  revalidateCollection,
  revalidateBookInfo,
  revalidatePreferences,
  revalidateHighlights,
  revalidateAiComments,
  hasBookContent,
  checkStorageQuota,
  getMetaFlag,
  hasMetaFlag,
  setMetaFlag,
  // `new Date()` is fine in app runtime; tests override this to stay
  // deterministic.
  now: () => new Date().toISOString(),
};
