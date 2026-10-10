import { useState } from "react";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { searchSourceIdentity } from "./source";

type Ready = Extract<ReaderStatusPayload, { status: "READY" }>;
// Keep a stable window for one immutable source, but revoke it immediately
// when the caller supplies another book, revision or authoritative chapter order.
export function useSearchSource(payload: Ready) {
  const identity = searchSourceIdentity(payload);
  const [stored, setStored] = useState(() => ({ identity, source: payload }));
  if (stored.identity !== identity) setStored({ identity, source: payload });
  return {
    identity,
    source: stored.identity === identity ? stored.source : payload,
  };
}
