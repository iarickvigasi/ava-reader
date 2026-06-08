// Background cache primer entry point. Runs once per device on the first home
// load and populates every offline cache up-front, instead of waiting for the
// user to visit each screen. Two tiers (see ./prime-metadata + ./prime-content).
//
// "Once per device" is enforced via the Dexie `meta` table. Each tier sets its
// own done-flag only on a terminal pass; when both are terminal we set
// `prime:completed` and never run again. An interrupted run (offline, user took
// over, page closed) leaves the flag unset and resumes on the next home load —
// matching "mark done only on full success".

import { DEFAULT_INTERNALS } from "./internals";
import {
  META_KEY_COMPLETED,
  META_KEY_CONTENT_DONE,
  META_KEY_METADATA_DONE,
} from "./meta";
import { primeBookContent } from "./prime-content";
import { primeMetadata } from "./prime-metadata";
import type { PrimeInternals, PrimeRuntime } from "./types";

export { collectSmartBooks } from "./smart-books";
export type {
  PrimeInternals,
  PrimeRuntime,
  SaveBookFn,
} from "./types";

// Idempotent and cheap to re-enter: returns immediately once the completion
// flag is set, or when the connection is metered/offline.
export async function primeAllCaches(
  runtime: PrimeRuntime,
  overrides: Partial<PrimeInternals> = {},
): Promise<void> {
  const d: PrimeInternals = { ...DEFAULT_INTERNALS, ...overrides };

  if (!d.shouldPrime()) {
    return;
  }
  if (await d.hasMetaFlag(META_KEY_COMPLETED)) {
    return;
  }

  let metadataDone = await d.hasMetaFlag(META_KEY_METADATA_DONE);
  if (!metadataDone) {
    metadataDone = await primeMetadata(runtime, d);
    if (metadataDone) {
      await d.setMetaFlag(META_KEY_METADATA_DONE, d.now());
    }
  }

  let contentDone = await d.hasMetaFlag(META_KEY_CONTENT_DONE);
  if (!contentDone) {
    contentDone = await primeBookContent(runtime, d);
    if (contentDone) {
      await d.setMetaFlag(META_KEY_CONTENT_DONE, d.now());
    }
  }

  if (metadataDone && contentDone) {
    await d.setMetaFlag(META_KEY_COMPLETED, d.now());
  }
}
