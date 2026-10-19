"use client";

import { useEffect, useState } from "react";
import { AUTH_TIMEOUT_MS } from "./with-deadline";

export type AuthReadiness = "loading" | "ready" | "unavailable";

export function useAuthReadiness(loaded: boolean): AuthReadiness {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setExpired(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded]);
  return loaded ? "ready" : expired ? "unavailable" : "loading";
}
