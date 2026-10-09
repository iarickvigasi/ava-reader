"use client";

import { useState, type SubmitEvent } from "react";
import type { CurrentUserPayload } from "@/lib/api-types/user";
import {
  persistConnectDraft,
  persistProfilePatch,
  useConnectDraft,
  useCurrentReadingBook,
  useProfileMutation,
  useProfileSync,
  type ConnectDraft,
} from "@/features/offline/buckets/me";
import { clampIntroduction, isPublishableIntroduction } from "./introduction";

export function useConnectProfile(user: CurrentUserPayload) {
  const stored = useConnectDraft();
  const pending = useProfileMutation();
  const book = useCurrentReadingBook();
  const flush = useProfileSync();
  const [draft, setDraft] = useState<ConnectDraft | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const values = draft ??
    stored ?? {
      introduction: user.introduction ?? "",
      shareCurrentBook: user.shareCurrentBook ?? false,
    };
  const published = user.profilePublished ?? false;
  const valid = isPublishableIntroduction(values.introduction);
  const dirty =
    values.introduction.trim() !== (user.introduction ?? "") ||
    values.shareCurrentBook !== (user.shareCurrentBook ?? false);

  function edit(change: Partial<ConnectDraft>) {
    const next = { ...values, ...change };
    setDraft(next);
    setError(false);
    void persistConnectDraft(next).catch(() => setError(true));
  }
  async function save(profilePublished: boolean, includeDraft: boolean) {
    setBusy(true);
    setError(false);
    try {
      await persistProfilePatch({
        profilePublished,
        ...(includeDraft
          ? {
              introduction: values.introduction.trim(),
              shareCurrentBook: values.shareCurrentBook,
            }
          : {}),
      });
      flush();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid && !busy && stored !== undefined) void save(true, true);
  }
  return {
    user,
    values,
    book,
    published,
    valid,
    dirty,
    busy,
    ready: stored !== undefined,
    setIntroduction: (value: string) =>
      edit({ introduction: clampIntroduction(value) }),
    setShareCurrentBook: (value: boolean) => edit({ shareCurrentBook: value }),
    submit,
    hide: () => {
      if (!busy) void save(false, false);
    },
    status:
      error || pending?.error
        ? "error"
        : pending
          ? "pending"
          : published
            ? "published"
            : "hidden",
  };
}
