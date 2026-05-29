"use client";

// Shared modal state for the "you're offline" dialog. The dialog auto-opens
// when (a) the app boots while offline OR (b) the connection drops while a
// reader route is active. It can also be opened manually by tapping the
// offline chip in any header.

import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState, } from "react";
import { usePathname } from "next/navigation";

import { isOnline, subscribeToNetworkState, } from "@/features/offline/net-state";

type OfflineModalCtx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const Ctx = createContext<OfflineModalCtx | null>(null);

export function useOfflineModal(): OfflineModalCtx {
  const value = useContext(Ctx);
  if (!value) {
    // Render-time fall back: the indicator may be mounted outside the
    // provider on some routes. Return a no-op rather than throwing so the
    // chip stays clickable (it just won't open a modal). Phase 2 will lift
    // the provider into the root layout so this branch becomes unreachable.
    return {
      isOpen: false,
      open: () => {},
      close: () => {},
    };
  }
  return value;
}

type OfflineModalProviderProps = {
  children: ReactNode;
};

export function OfflineModalProvider({ children }: OfflineModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  // We need the latest pathname inside the subscription callback so the
  // "connection dropped while reading" trigger reflects the current route
  // without re-subscribing on every navigation. Set the ref in an effect
  // (not during render — React would otherwise flag this as an unsafe
  // mutation under concurrent features).
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // Drive modal state from the network store's transitions directly. This
  // matches React's guidance for subscribing to external systems: instead
  // of observing `online` via useNetworkState + an effect (which would
  // cascade renders), we subscribe to the store callback, which fires only
  // on real online ↔ offline flips.
  //
  // The `react-hooks/set-state-in-effect` rule still flags the cold-start
  // setState because it's syntactically inside useEffect; the rule's
  // recommended escape for "subscribe + cold-read on mount" is exactly the
  // pattern below, so we acknowledge it with a targeted disable rather
  // than restructuring around it.
  useEffect(() => {
    const applyOnline = (nextOnline: boolean) => {
      if (nextOnline) {
        setIsOpen(false);
        return;
      }
      // Auto-open when offline
      setIsOpen(true);
    };
    // Cold-start read. If we boot offline, surface the modal immediately
    // (this also covers the case where the user reloaded an offline tab).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isOnline()) setIsOpen(true);
    return subscribeToNetworkState(applyOnline);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <Ctx.Provider value={{ isOpen, open, close }}>
      {children}
      <OfflineModal />
    </Ctx.Provider>
  );
}

function OfflineModal() {
  const { isOpen, close } = useOfflineModal();
  const t = useTranslations("offline.modal");

  // Close on Escape — mirrors what the other modals in the app do.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-paper p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="offline-modal-title"
          className="font-reader text-[1.75rem] leading-[1.1] text-title"
        >
          {t("title")}
        </h2>
        <p className="mt-4 text-base leading-7 text-copy">
          {t("body")}
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={close}
            className="inline-flex h-11 items-center rounded-pl bg-brand-fill px-5 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-brand-fill-strong"
          >
            {t("dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
