import { createContext } from "react";
import type { readReaderCover } from "@/features/offline/buckets/library";

export const ReaderCoverContext =
  createContext<Awaited<ReturnType<typeof readReaderCover>>>(null);
