"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReaderDevice } from "@/features/reader/modes/use-reader-device";

export type ReaderPanel =
  | "contents"
  | "preferences"
  | "ai-chats"
  | "highlights"
  | "ai-comments"
  | "ai-toolbox";

type ReaderUiContextValue = {
  isBilingual: boolean;
  isPhone: boolean;
  toggleBilingual: () => void;
  activePanel: ReaderPanel | null;
  closePanel: () => void;
  openPanel: (panel: ReaderPanel) => void;
  togglePanel: (panel: ReaderPanel) => void;
};

const ReaderUiContext = createContext<ReaderUiContextValue | null>(null);

export function ReaderUiProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<ReaderPanel | null>(null);
  const [manualBilingual, setManualBilingual] = useState(false);
  const device = useReaderDevice();
  const isPhone = device !== "desktop";
  const isBilingual = isPhone ? device === "phone-landscape" : manualBilingual;

  const value = useMemo<ReaderUiContextValue>(
    () => ({
      isBilingual,
      isPhone,
      toggleBilingual: () => setManualBilingual((current) => !current),
      activePanel,
      closePanel: () => setActivePanel(null),
      openPanel: (panel) => setActivePanel(panel),
      togglePanel: (panel) =>
        setActivePanel((current) => (current === panel ? null : panel)),
    }),
    [activePanel, isBilingual, isPhone],
  );

  return (
    <ReaderUiContext.Provider value={value}>
      {children}
    </ReaderUiContext.Provider>
  );
}

export function useReaderUi() {
  const value = useContext(ReaderUiContext);

  if (!value) {
    throw new Error("useReaderUi must be used within a ReaderUiProvider.");
  }

  return value;
}
