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

import { DEFAULT_INTERNALS } from "./internals";
import {
  CONTENT_CONSENT_GRANTED,
  META_KEY_COMPLETED,
  META_KEY_CONTENT_CONSENT,
  META_KEY_CONTENT_DONE,
  META_KEY_METADATA_DONE,
} from "./meta";
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
      contentDone = await primeBookContent(runtime, d);
      if (contentDone) {
        await d.setMetaFlag(META_KEY_CONTENT_DONE, d.now());
      }
    }
  }

  if (metadataDone && contentDone) {
    await d.setMetaFlag(META_KEY_COMPLETED, d.now());
  }
  return { contentConsentNeeded };
}

// Decides whether the content tier may run now. Save-Data off → always allowed.
// Save-Data on → needs an explicit "granted" consent; anything else means we
// ask (the island shows the modal). A decline isn't persisted, so we re-offer
// next session rather than remembering "no" forever.
async function resolveContentConsent(
  d: PrimeInternals,
): Promise<{ allowed: boolean; consentNeeded: boolean }> {
  if (!d.isSaveDataOn()) {
    return { allowed: true, consentNeeded: false };
  }
  const consent = await d.getMetaFlag(META_KEY_CONTENT_CONSENT);
  if (consent === CONTENT_CONSENT_GRANTED) {
    return { allowed: true, consentNeeded: false };
  }
  return { allowed: false, consentNeeded: true };
}
