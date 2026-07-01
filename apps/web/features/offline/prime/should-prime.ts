// Gate for the background cache primer. We only prime when it's cheap and
// polite to do so: a live connection that the user hasn't flagged as metered.
//
// The Network Information API is still non-standard, so we treat its absence
// as "no objection" — desktop browsers that don't expose it should prime
// freely. We only *suppress* priming on an explicit Save-Data signal or a
// clearly slow effective connection type.

import { isOnline } from "../net/net-state";

// `navigator.connection` isn't in the DOM lib's typings everywhere; describe
// just the bits we read.
type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g" | string;
};

const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g"]);

function readConnection(): NetworkInformationLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

// True when the cheap metadata tier may run: a live connection that isn't
// painfully slow. Deliberately ignores Save-Data — metadata is a few small
// JSON payloads and is essential for offline home/library, so we prime it even
// on Data Saver. The heavy content tier is what Save-Data actually gates.
export function canPrimeMetadata(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (!isOnline()) {
    return false;
  }
  const connection = readConnection();
  if (!connection) {
    return true; // no Network Information API → assume a usable connection
  }
  if (
    typeof connection.effectiveType === "string" &&
    SLOW_EFFECTIVE_TYPES.has(connection.effectiveType)
  ) {
    return false;
  }
  return true;
}

// True when the user has Data Saver on. The content tier requires explicit
// consent (a modal) in this case; an off signal lets it run automatically.
export function isSaveDataOn(): boolean {
  return readConnection()?.saveData === true;
}
