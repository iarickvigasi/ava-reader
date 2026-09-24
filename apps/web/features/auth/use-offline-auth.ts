"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { getAccountToken } from "./get-account-token";

// Each closure stays bound to its original data owner, including after awaits.
export function useOfflineAuth() {
  const auth = useAuth();
  const { userId, getToken: clerkGetToken } = auth;
  const getToken = useCallback(
    () => getAccountToken(userId, clerkGetToken),
    [userId, clerkGetToken],
  );
  return { ...auth, getToken };
}
