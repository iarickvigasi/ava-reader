"use client";

import { useEffect, useState, type CSSProperties } from "react";

export const READER_TOAST_EVENT = "ava-reader:toast";
export const READER_TOAST_DEFAULT_DURATION_MS = 6000;
const READER_TOAST_ENTER_MS = 220;
const READER_TOAST_EXIT_MS = 320;

export type ReaderToastTone = "info" | "warning" | "error";

export type ReaderToastDetail = {
  durationMs?: number;
  message: string;
  tone?: ReaderToastTone;
};

type ToastState = ReaderToastDetail & { id: number };
type ToastPhase = "entering" | "leaving";

/**
 * Dispatches a transient toast message. Listened to by `<ReaderToast />`.
 * Safe to call from anywhere on the client (including effect handlers).
 */
export function emitReaderToast(detail: ReaderToastDetail) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<ReaderToastDetail>(READER_TOAST_EVENT, { detail }),
  );
}

// Pastel, theme-aware tone styles. Backgrounds are mixed with `transparent`
// so the underlying page shows through; pair with `backdrop-filter: blur`
// for legibility. All colors derive from the app's CSS variables, so light
// and dark themes both pick up matching shades automatically.
const TONE_STYLES: Record<ReaderToastTone, CSSProperties> = {
  info: {
    background: "color-mix(in srgb, var(--surface-strong) 55%, transparent)",
    borderColor: "color-mix(in srgb, var(--line-strong) 70%, transparent)",
    color: "var(--copy-strong)",
  },
  warning: {
    background: "color-mix(in srgb, var(--soft-tone-fill) 60%, transparent)",
    borderColor: "color-mix(in srgb, var(--title) 22%, transparent)",
    color: "var(--copy-strong)",
  },
  error: {
    background: "color-mix(in srgb, var(--danger) 14%, transparent)",
    borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)",
    color: "var(--copy-strong)",
  },
};

/**
 * Small, dependency-free toast surface for transient reader-side messages
 * (e.g. progress save failures). Auto-dismisses with a slide-down animation.
 */
export function ReaderToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [phase, setPhase] = useState<ToastPhase>("entering");

  useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<ReaderToastDetail>;
      if (!customEvent.detail?.message) {
        return;
      }
      setPhase("entering");
      setToast({
        id: Date.now(),
        ...customEvent.detail,
      });
    };

    window.addEventListener(READER_TOAST_EVENT, handleToast);
    return () => {
      window.removeEventListener(READER_TOAST_EVENT, handleToast);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const visibleMs = toast.durationMs ?? READER_TOAST_DEFAULT_DURATION_MS;

    const startExit = window.setTimeout(() => {
      setPhase((current) => (current === "entering" ? "leaving" : current));
    }, visibleMs);

    const removeAfterExit = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, visibleMs + READER_TOAST_EXIT_MS);

    return () => {
      window.clearTimeout(startExit);
      window.clearTimeout(removeAfterExit);
    };
  }, [toast]);

  if (!toast) {
    return null;
  }

  const tone = toast.tone ?? "info";
  const animation =
    phase === "leaving"
      ? `reader-toast-exit ${READER_TOAST_EXIT_MS}ms ease-in forwards`
      : `reader-toast-enter ${READER_TOAST_ENTER_MS}ms ease-out both`;

  const pillStyle: CSSProperties = {
    ...TONE_STYLES[tone],
    animation,
    backdropFilter: "blur(12px) saturate(125%)",
    WebkitBackdropFilter: "blur(12px) saturate(125%)",
    boxShadow: "var(--shadow-soft)",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      <div
        className="pointer-events-auto max-w-sm rounded-full border px-4 py-2 text-sm font-medium tracking-tight"
        style={pillStyle}
      >
        {toast.message}
      </div>
    </div>
  );
}
