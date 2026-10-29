"use client";
import { useState, type FormEvent } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { publishReview } from "@/features/admin/reviews/publish-review";
import type { ReadingReview } from "@/lib/api-types/reading-review";

export function usePublishDialog(entry: ReadingReview, close: () => void) {
  const { getToken } = useOfflineAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    setPending(true);
    setError("");
    try {
      const submitter = (event.nativeEvent as SubmitEvent)
        .submitter as HTMLButtonElement | null;
      await publishReview(entry, form, getToken, submitter?.value || "publish");
      window.dispatchEvent(new Event("ava:catalog-updated"));
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Publication failed");
    } finally {
      setPending(false);
    }
  }
  return { publish, pending, error };
}
