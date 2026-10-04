import type { ReaderLocator } from "@/lib/api-types";
import type { NavigationScope } from "./navigation-scope";
import { sameReaderPlace } from "./jump-target";

export type JumpRequest = {
  originScope?: NavigationScope;
  note?: boolean;
  rollback?: boolean;
  sequence: number;
  origin: ReaderLocator;
  destination: ReaderLocator;
  back: boolean;
};
export type JumpHistory = {
  referenceBlockId?: string;
  referenceChapterId?: string;
  entries: ReaderLocator[];
  entryScopes: (NavigationScope | undefined)[];
  pending: JumpRequest | null;
  sequence: number;
};
export const emptyJumpHistory = (): JumpHistory => ({
  entries: [],
  entryScopes: [],
  pending: null,
  sequence: 0,
});

export function beginJump(
  state: JumpHistory,
  origin: ReaderLocator,
  destination: ReaderLocator,
  back = false,
  note = false,
  originScope?: NavigationScope,
): JumpHistory {
  if (sameReaderPlace(origin, destination))
    return { ...state, pending: null, sequence: state.sequence + 1 };
  const sequence = state.sequence + 1;
  return {
    ...state,
    sequence,
    pending: { origin, originScope, destination, back, sequence, note },
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
    entryScopes:
      !success || pending.rollback
        ? state.entryScopes
        : pending.back
          ? state.entryScopes.slice(0, -1)
          : [...state.entryScopes, pending.originScope].slice(-100),
    pending: null,
    referenceChapterId:
      success && !pending.rollback
        ? pending.note
          ? pending.destination.chapterId
          : undefined
        : state.referenceChapterId,
    referenceBlockId:
      success && !pending.rollback
        ? pending.note
          ? pending.destination.blockId
          : undefined
        : state.referenceBlockId,
  };
}
