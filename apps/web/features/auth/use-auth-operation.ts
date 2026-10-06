"use client";

import { useEffect, useState } from "react";
import { createAuthOperation, type AuthOperationState } from "./auth-operation";

export function useAuthOperation(loaded: boolean, failed: () => void) {
  const [state, setState] = useState<AuthOperationState>("idle");
  const [operation] = useState(() =>
    createAuthOperation(loaded, setState, failed),
  );
  useEffect(() => {
    operation.setReady(loaded);
  }, [loaded, operation]);
  useEffect(() => {
    operation.mount();
    return () => operation.dispose();
  }, [operation]);
  return {
    state,
    busy: state !== "idle",
    canCall: operation.canCall,
    current: operation.current,
    locked: operation.locked,
    run: (work: () => Promise<void>) => operation.run(loaded, work),
  };
}
