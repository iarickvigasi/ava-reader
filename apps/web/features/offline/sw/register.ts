// Client-side service-worker registration.
//
// Gated on production: registering in dev would cache Next's dev assets and
// break HMR. The worker URL carries the build version as ?v=… so a new build
// installs a fresh worker (different bytes) and evicts the previous caches on
// activate.

import { emitAppToast } from "@/components/app/core/app-toast";

// Session-scoped dedupe key so a persistent failure doesn't spam the toast
// on every page navigation within the same tab/session.
const SW_FAILED_TOAST_KEY = "ava-reader:sw-failed-toast-shown";

type RegisterOptions = {
  // Pre-localized toast message shown if the worker fails to register. The
  // caller (a React component with `useTranslations`) passes this in; the
  // registrar itself can't use the intl hook because it isn't React.
  failureToastMessage?: string;
};

export function registerServiceWorker(options: RegisterOptions = {}): void {
  if (typeof window === "undefined") {
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const version = process.env.NEXT_PUBLIC_SW_VERSION ?? "prod";
  const url = `/sw.js?v=${encodeURIComponent(version)}`;

  const register = () => {
    navigator.serviceWorker.register(url, { scope: "/" }).catch(() => {
      // Registration failure is non-fatal — the app works online without the
      // worker; it just won't have offline shell caching. Surface this to
      // the user via the global AppToast so they know why offline navigation
      // won't work. Session-scoped dedupe avoids nagging on every nav.
      if (!options.failureToastMessage) {
        return;
      }
      try {
        if (window.sessionStorage.getItem(SW_FAILED_TOAST_KEY) === "1") {
          return;
        }
        window.sessionStorage.setItem(SW_FAILED_TOAST_KEY, "1");
      } catch {
        // sessionStorage may be disabled; falling through to always-show is
        // the safer failure mode (user still hears about the issue).
      }
      emitAppToast({
        message: options.failureToastMessage,
        tone: "warning",
        // A bit longer than the default so a single-line warning doesn't
        // vanish before the user can read it.
        durationMs: 9000,
      });
    });
  };

  // This runs from a React effect, which fires *after* hydration — by which
  // point the window `load` event has usually already fired. Listening for
  // `load` unconditionally would mean the callback never runs and the worker
  // never registers. So register immediately when the document is already
  // past loading, and only defer to `load` when we're genuinely still in it.
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
