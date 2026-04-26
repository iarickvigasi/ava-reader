"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ReaderPanel = "contents" | "preferences";

type ReaderUiContextValue = {
  activePanel: ReaderPanel | null;
  closePanel: () => void;
  openPanel: (panel: ReaderPanel) => void;
  togglePanel: (panel: ReaderPanel) => void;
};

const ReaderUiContext = createContext<ReaderUiContextValue | null>(null);

export function ReaderUiProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<ReaderPanel | null>(null);

  const value = useMemo<ReaderUiContextValue>(
    () => ({
      activePanel,
      closePanel: () => setActivePanel(null),
      openPanel: (panel) => setActivePanel(panel),
      togglePanel: (panel) =>
        setActivePanel((current) => (current === panel ? null : panel)),
    }),
    [activePanel],
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
