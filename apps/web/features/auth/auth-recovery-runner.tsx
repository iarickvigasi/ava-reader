"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { startClerkRecovery } from "./recover-clerk";

export function AuthRecoveryRunner() {
  const clerk = useClerk();
  useEffect(() => startClerkRecovery(clerk), [clerk]);
  return null;
}
