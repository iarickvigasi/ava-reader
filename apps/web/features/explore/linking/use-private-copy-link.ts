"use client";
import { useState } from "react";
import { useCatalogLink } from "@/features/offline/buckets/library";
export function usePrivateCopyLink(id: string) {
  const state = useCatalogLink(id);
  const [action, setAction] = useState<"link" | "unlink" | null>(null);
  const [unlinkPending, setUnlinkPending] = useState(false);
  const [error, setError] = useState("");
  async function unlink() {
    if (unlinkPending) return;
    setUnlinkPending(true);
    setError("");
    try {
      await state.save(null);
      setAction(null);
    } catch {
      setError("Could not save the unlink on this device. Try again.");
    } finally {
      setUnlinkPending(false);
    }
  }
  return {
    ...state,
    action,
    setAction,
    unlink,
    unlinkPending,
    error: error || state.error,
  };
}
