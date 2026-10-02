"use client";

// Browser connectivity drives automatic notices; API probe failures only gate sync.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  isBrowserOnline,
  subscribeToBrowserConnectivity,
} from "@/features/offline/net/browser-connectivity";
import {
  hasSeenOfflineModal,
  markOfflineModalSeen,
} from "@/features/offline/notices/seen-modal";
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
    if (!isBrowserOnline() && !hasSeenOfflineModal()) {
      markOfflineModalSeen();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
    }
    return subscribeToBrowserConnectivity(applyOnline);
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
