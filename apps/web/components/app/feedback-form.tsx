"use client";

import { useMemo, useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { CameraIcon } from "@/components/app/app-icons";
import { cn } from "@/lib/cn";
import { getPublicApiBaseUrl } from "@/lib/api";

type FeedbackFormProps = {
  className?: string;
};

export function FeedbackForm({ className }: FeedbackFormProps) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const attachmentLabel = useMemo(
    () => attachment?.name ?? "Attach Screenshot",
    [attachment],
  );

  async function submitFeedback() {
    if (!isLoaded || !isSignedIn) {
      setStatus("Sign in to submit feedback.");
      return;
    }

    const token = await getToken();

    if (!token) {
      setStatus("No session token was available.");
      return;
    }

    const formData = new FormData();
    formData.append("message", message);

    if (attachment) {
      formData.append("attachment", attachment);
    }

    const response = await fetch(`${getPublicApiBaseUrl()}/api/feedback`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setStatus(payload?.message ?? "The feedback could not be submitted.");
      return;
    }

    setMessage("");
    setAttachment(null);
    setStatus("Feedback received. Thank you.");
    router.refresh();
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="rounded-[18px] border border-line/50 bg-soft-fill px-5 py-5 shadow-[var(--shadow-soft)]">
        <textarea
          className="min-h-40 w-full resize-none bg-transparent text-base text-copy-strong outline-none placeholder:text-copy/50"
          placeholder="Type your feedback here..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink">
        <CameraIcon className="size-4" />
        <span className="truncate">{attachmentLabel}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex flex-col gap-3 sm:items-end">
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-[12px] border border-brand-fill bg-brand-fill px-8 text-xs font-bold uppercase tracking-[0.2em] text-brand-foreground shadow-[var(--shadow-card)] transition hover:bg-brand-fill-strong disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || message.trim().length < 4}
          onClick={() =>
            startTransition(() => {
              void submitFeedback();
            })
          }
        >
          {isPending ? "Submitting..." : "Submit"}
        </button>
        {status ? <p className="text-sm text-muted">{status}</p> : null}
      </div>
    </div>
  );
}
