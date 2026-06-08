// Gate for the background cache primer. We only prime when it's cheap and
// polite to do so: a live connection that the user hasn't flagged as metered.
//
// The Network Information API is still non-standard, so we treat its absence
// as "no objection" — desktop browsers that don't expose it should prime
// freely. We only *suppress* priming on an explicit Save-Data signal or a
// clearly slow effective connection type.

import { isOnline } from "../net-state";

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

// True when it's appropriate to start priming. Checked once before a run and
// again is cheap — callers may re-check between heavy steps.
export function shouldPrime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (!isOnline()) {
    return false;
  }
  const connection = readConnection();
  if (!connection) {
    // No Network Information API → assume an unmetered connection.
    return true;
  }
  if (connection.saveData === true) {
    return false;
  }
  if (
    typeof connection.effectiveType === "string" &&
    SLOW_EFFECTIVE_TYPES.has(connection.effectiveType)
  ) {
    return false;
  }
  return true;
}
