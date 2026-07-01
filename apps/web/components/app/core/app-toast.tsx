"use client";

// App-wide transient toast surface. Mounted once in <AppShell> so any client
// code (reader hooks, sync runners, the service-worker registrar, …) can
// surface a short message without coupling to a React tree.
//
// Publishers call `emitAppToast({ message, tone })` from anywhere in the
// browser; this component subscribes to the same window CustomEvent and
// renders a single auto-dismissing pill at the bottom of the viewport.

import { useEffect, useState, type CSSProperties } from "react";

export const APP_TOAST_EVENT = "ava-reader:toast";
export const APP_TOAST_DEFAULT_DURATION_MS = 6000;
const APP_TOAST_ENTER_MS = 220;
const APP_TOAST_EXIT_MS = 320;

export type AppToastTone = "info" | "warning" | "error";

export type AppToastDetail = {
  durationMs?: number;
  message: string;
  tone?: AppToastTone;
};

type ToastState = AppToastDetail & { id: number };
type ToastPhase = "entering" | "leaving";

/**
 * Dispatches a transient toast message. Listened to by `<AppToast />`.
 * Safe to call from anywhere on the client (including effect handlers and
 * non-React modules).
 */
export function emitAppToast(detail: AppToastDetail) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<AppToastDetail>(APP_TOAST_EVENT, { detail }),
  );
}

// Pastel, theme-aware tone styles. Backgrounds are mixed with `transparent`
// so the underlying page shows through; pair with `backdrop-filter: blur`
// for legibility. All colors derive from the app's CSS variables, so light
// and dark themes both pick up matching shades automatically.
const TONE_STYLES: Record<AppToastTone, CSSProperties> = {
  info: {
    background: "color-mix(in srgb, var(--surface-strong) 55%, transparent)",
    color: "var(--copy-strong)",
  },
  warning: {
    background: "color-mix(in srgb, var(--soft-tone-fill) 60%, transparent)",
    color: "var(--copy-strong)",
  },
  error: {
    background: "color-mix(in srgb, var(--danger) 14%, transparent)",
    color: "var(--copy-strong)",
  },
};

/**
 * Small, dependency-free toast surface for transient app-side messages
 * (progress save failures, highlight sync drops, offline notices, …).
 * Auto-dismisses with a slide-down animation.
 */
export function AppToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [phase, setPhase] = useState<ToastPhase>("entering");

  useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<AppToastDetail>;
      if (!customEvent.detail?.message) {
        return;
      }
      setPhase("entering");
      setToast({
        id: Date.now(),
        ...customEvent.detail,
      });
    };

    window.addEventListener(APP_TOAST_EVENT, handleToast);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, handleToast);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const visibleMs = toast.durationMs ?? APP_TOAST_DEFAULT_DURATION_MS;

    const startExit = window.setTimeout(() => {
      setPhase((current) => (current === "entering" ? "leaving" : current));
    }, visibleMs);

    const removeAfterExit = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, visibleMs + APP_TOAST_EXIT_MS);

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
      ? `reader-toast-exit ${APP_TOAST_EXIT_MS}ms ease-in forwards`
      : `reader-toast-enter ${APP_TOAST_ENTER_MS}ms ease-out both`;

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
        className="pointer-events-auto max-w-sm rounded-full px-4 py-2 text-sm font-medium tracking-tight"
        style={pillStyle}
      >
        {toast.message}
      </div>
    </div>
  );
}
