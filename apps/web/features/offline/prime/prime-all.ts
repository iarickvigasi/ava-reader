// Background cache primer entry point. Runs on home load and populates every
// offline cache up-front, instead of waiting for the user to visit each screen.
// Two tiers (see ./prime-metadata + ./prime-content).
//
// "Once per device" is enforced via the Dexie `meta` table. Each tier sets its
// own done-flag only on a terminal pass; when both are terminal we set
// `prime:completed` and never run again. An interrupted run (offline, user took
// over, page closed) leaves the flag unset and resumes on the next home load —
// matching "mark done only on full success".
//
// The heavy content tier is gated by Save-Data: off → runs automatically; on →
// runs only with the user's consent, which the client island collects via a
// modal. When consent is needed we return `contentConsentNeeded` so the island
// can show it; the metadata tier always runs (it's negligible).

import { resolveContentConsent } from "./consent";
import { DEFAULT_INTERNALS } from "./internals";
import {
  META_KEY_COMPLETED,
  META_KEY_CONTENT_DONE,
  META_KEY_METADATA_DONE,
} from "./meta";
import { hasOutstandingOfflineContent } from "./outstanding";
import { primeBookContent } from "./prime-content";
import { primeMetadata } from "./prime-metadata";
import type { PrimeInternals, PrimeResult, PrimeRuntime } from "./types";

export { collectSmartBooks } from "./smart-books";
export type {
  PrimeInternals,
  PrimeResult,
  PrimeRuntime,
  SaveBookFn,
} from "./types";

const NO_CONSENT_NEEDED: PrimeResult = { contentConsentNeeded: false };

// Idempotent and cheap to re-enter: returns immediately once the completion
// flag is set, or when the connection is too slow / offline.
export async function primeAllCaches(
  runtime: PrimeRuntime,
  overrides: Partial<PrimeInternals> = {},
): Promise<PrimeResult> {
  const d: PrimeInternals = { ...DEFAULT_INTERNALS, ...overrides };

  if (!d.canPrimeMetadata()) {
    return NO_CONSENT_NEEDED;
  }
  if (await d.hasMetaFlag(META_KEY_COMPLETED)) {
    // The once-per-device prime is done, but the user can still mark a NEW book
    // offline later (e.g. tapped Save while disconnected), or start reading a
    // different book. Reconcile any such target whose content isn't cached yet
    // — page-independent. Offline-marked books are consent-exempt (an explicit
    // request is the user's consent even under Save-Data); the current book is
    // not, so it's gated by the same Save-Data consent the content tier uses.
    const { allowed } = await resolveContentConsent(d);
    if (await hasOutstandingOfflineContent(d, allowed)) {
      const reconciled = await primeBookContent(runtime, d, allowed);
      if (reconciled) {
        runtime.onProgress?.({ phase: "ready" });
      }
    }
    return NO_CONSENT_NEEDED;
  }

  let metadataDone = await d.hasMetaFlag(META_KEY_METADATA_DONE);
  if (!metadataDone) {
    metadataDone = await primeMetadata(runtime, d);
    if (metadataDone) {
      await d.setMetaFlag(META_KEY_METADATA_DONE, d.now());
    }
  }

  let contentDone = await d.hasMetaFlag(META_KEY_CONTENT_DONE);
  let contentConsentNeeded = false;
  if (!contentDone) {
    const { allowed, consentNeeded } = await resolveContentConsent(d);
    contentConsentNeeded = consentNeeded;
    if (allowed) {
      contentDone = await primeBookContent(runtime, d, true);
      if (contentDone) {
        await d.setMetaFlag(META_KEY_CONTENT_DONE, d.now());
      }
    }
  }

  if (metadataDone && contentDone) {
    // First-ever completion (warm devices early-return above): a brief "ready"
    // beat for the header chip. The dwell + hide live in header-chip-state.
    await d.setMetaFlag(META_KEY_COMPLETED, d.now());
    runtime.onProgress?.({ phase: "ready" });
  }
  return { contentConsentNeeded };
}
