"use client";

import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { readProfileMutation } from "./profile-storage";
import type { ProfileMutation } from "./types";

export function useProfileMutation() {
  const [pending, setPending] = useState<ProfileMutation | null>(null);
  useEffect(() => {
    const subscription = liveQuery(() => readProfileMutation()).subscribe(
      setPending,
    );
    return () => subscription.unsubscribe();
  }, []);
  return pending;
}
