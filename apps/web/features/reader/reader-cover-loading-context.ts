import { createContext } from "react";

export const ReaderCoverLoadingContext = createContext<{
  opening: boolean;
  reportLoading: (loading: boolean) => void;
} | null>(null);
