import type { ReaderLocator } from "@/lib/api-types";
import { sameReaderPlace } from "./jump-target";

export type JumpRequest = {
  note?: boolean;
  rollback?: boolean;
  sequence: number;
  origin: ReaderLocator;
  destination: ReaderLocator;
  back: boolean;
};
export type JumpHistory = {
  referenceBlockId?: string;
  entries: ReaderLocator[];
  pending: JumpRequest | null;
  sequence: number;
};
export const emptyJumpHistory = (): JumpHistory => ({
  entries: [],
  pending: null,
  sequence: 0,
});

export function beginJump(
  state: JumpHistory,
  origin: ReaderLocator,
  destination: ReaderLocator,
  back = false,
  note = false,
): JumpHistory {
  if (sameReaderPlace(origin, destination))
    return { ...state, pending: null, sequence: state.sequence + 1 };
  const sequence = state.sequence + 1;
  return {
    ...state,
    sequence,
    pending: { origin, destination, back, sequence, note },
  };
}

export function finishJump(
  state: JumpHistory,
  sequence: number,
  success: boolean,
): JumpHistory {
  const pending = state.pending;
  if (!pending || pending.sequence !== sequence) return state;
  const entries =
    !success || pending.rollback
      ? state.entries
      : pending.back
        ? state.entries.slice(0, -1)
        : [...state.entries, pending.origin].slice(-100);
  return {
    ...state,
    entries,
    pending: null,
    referenceBlockId:
      success && !pending.rollback
        ? pending.note
          ? pending.destination.blockId
          : undefined
        : state.referenceBlockId,
  };
}
