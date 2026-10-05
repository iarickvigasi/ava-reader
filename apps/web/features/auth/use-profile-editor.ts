"use client";

import { useState, type SubmitEvent } from "react";
import type { CurrentUserPayload } from "@/lib/api-types/user";
import {
  persistProfilePatch,
  useProfileMutation,
  useProfileSync,
} from "@/features/offline/buckets/me";

export function useProfileEditor(user: CurrentUserPayload) {
  const pending = useProfileMutation();
  const flush = useProfileSync();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [telegramUrl, setTelegramUrl] = useState(user.telegramUrl ?? "");
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const isDeveloper = user.role === "DEVELOPER";
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    setBusy(true);
    try {
      await persistProfilePatch({
        displayName: displayName.trim(),
        ...(isDeveloper ? { telegramUrl: telegramUrl.trim() || null } : {}),
      });
      setSaved(true);
      flush();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return {
    displayName,
    setDisplayName,
    telegramUrl,
    setTelegramUrl,
    isDeveloper,
    save,
    busy,
    status:
      error || pending?.error
        ? "error"
        : pending
          ? "pending"
          : saved
            ? "saved"
            : null,
  };
}
