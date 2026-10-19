import { createContext, useContext } from "react";
import type { ReaderLocator } from "@/lib/api-types";
import type { RestoreIntent } from "@/features/reader/navigation";

export type ReaderNavigationActions = {
  jump: (
    destination: ReaderLocator,
    origin?: ReaderLocator,
    returning?: boolean,
  ) => void;
  back: () => void;
  leavePassage: () => void;
  settle: (intent: RestoreIntent, success: boolean) => void;
  canBack: boolean;
  referenceBlockId?: string;
  pending: boolean;
  error: string | null;
};
export const ReaderNavigationContext =
  createContext<ReaderNavigationActions | null>(null);
export const useReaderNavigationActions = () =>
  useContext(ReaderNavigationContext);
