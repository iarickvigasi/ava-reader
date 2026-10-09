"use client";

import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { readConnectDraft } from "./connect-draft-storage";
import type { ConnectDraft } from "./types";

export function useConnectDraft() {
  const [stored, setStored] = useState<ConnectDraft | null | undefined>(
    undefined,
  );
  useEffect(() => {
    const subscription = liveQuery(readConnectDraft).subscribe({
      next: setStored,
      error: () => setStored(null),
    });
    return () => subscription.unsubscribe();
  }, []);
  return stored;
}
