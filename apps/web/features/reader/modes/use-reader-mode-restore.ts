import { useState } from "react";
import type { ReaderModeRestoreInput } from "./mode-restore-types";
import { resolveReaderModeRestore } from "./resolve-mode-restore";

export function useReaderModeRestore(input: ReaderModeRestoreInput) {
  const [state, setState] = useState(() =>
    resolveReaderModeRestore(null, input),
  );
  const next = resolveReaderModeRestore(state, input);
  // Guarded render-time reconciliation gives the newly mounted renderer the
  // right restore immediately; an effect would first commit the stale intent.
  if (next !== state) setState(next);
  return next.override ?? input.restoreIntent;
}
