// Client-side service-worker registration.
//
// Gated on production: registering in dev would cache Next's dev assets and
// break HMR. The worker URL carries the build version as ?v=… so a new build
// installs a fresh worker (different bytes) and evicts the previous caches on
// activate.

export function registerServiceWorker(): void {
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
      // worker; it just won't have offline shell caching.
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
