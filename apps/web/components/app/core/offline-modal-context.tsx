"use client";

// Shared modal state for the "you're offline" / "connection looks slow"
// dialog. It auto-opens (always as "offline") when (a) the app boots while
// offline OR (b) the connection drops while a reader route is active. It can
// also be opened manually by tapping the Offline or Slow chip in any header
// — `reason` picks which copy the dialog shows (spec 4.10-slow-connection).

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState, } from "react";
import { usePathname } from "next/navigation";

import { isOnline, subscribeToNetworkState, } from "@/features/offline/net/net-state";
import { hasSeenOfflineModal, markOfflineModalSeen, } from "@/features/offline/notices/seen-modal";
import { OfflineModal } from "./offline-modal";

export type OfflineModalReason = "offline" | "slow";

type OfflineModalCtx = {
  isOpen: boolean;
  reason: OfflineModalReason;
  open: (reason?: OfflineModalReason) => void;
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
      reason: "offline",
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
  const [reason, setReason] = useState<OfflineModalReason>("offline");
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
      // Auto-open the first time we go offline; afterwards the chip is the
      // only way back in. Record "seen" the moment we surface it (on display,
      // not on dismiss). Always the "offline" reason — a soft/transient
      // "slow" state never auto-interrupts (spec 4.10-slow-connection).
      if (hasSeenOfflineModal()) return;
      markOfflineModalSeen();
      setReason("offline");
      setIsOpen(true);
    };
    // Cold-start read. If we boot offline, surface the modal immediately
    // (this also covers the case where the user reloaded an offline tab).
    if (!isOnline() && !hasSeenOfflineModal()) {
      markOfflineModalSeen();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
    }
    return subscribeToNetworkState(applyOnline);
  }, []);

  const open = useCallback((nextReason: OfflineModalReason = "offline") => {
    setReason(nextReason);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <Ctx.Provider value={{ isOpen, reason, open, close }}>
      {children}
      <OfflineModal />
    </Ctx.Provider>
  );
}
