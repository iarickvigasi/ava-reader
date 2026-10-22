"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getActiveUserId } from "@/features/offline/db";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { readSignOutIntent } from "./local-sign-out";
import { offlineLoginDestination } from "./offline-login-destination";

export function useOfflineLogin() {
  const online = useNetworkState();
  const router = useRouter();
  useEffect(() => {
    const destination = offlineLoginDestination({
      online,
      owner: getActiveUserId(),
      signedOut: !!readSignOutIntent(),
    });
    if (destination) router.replace(destination);
  }, [online, router]);
  return online;
}
