// Decides whether the heavy content tier may run now. Save-Data off → always
// allowed. Save-Data on → needs an explicit "granted" consent; anything else
// means we ask (the island shows the modal). A decline isn't persisted, so we
// re-offer next session rather than remembering "no" forever.

import { CONTENT_CONSENT_GRANTED, META_KEY_CONTENT_CONSENT } from "./meta";
import type { PrimeInternals } from "./types";

export async function resolveContentConsent(
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
