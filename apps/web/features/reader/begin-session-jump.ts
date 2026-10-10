import type { ReaderLocator } from "@/lib/api-types";
import { beginJump, type JumpHistory } from "./jump-history";
import { sameNavigationScope, type NavigationScope } from "./navigation-scope";
import { sameReaderPlace } from "./jump-target";

export function beginSessionJump(
  state: JumpHistory,
  origin: ReaderLocator,
  destination: ReaderLocator,
  returning: boolean,
  scope?: NavigationScope,
) {
  const fromNote =
    state.referenceBlockId === origin.blockId &&
    state.referenceChapterId === origin.chapterId;
  const back =
    (returning || fromNote) &&
    sameNavigationScope(state.entryScopes.at(-1), scope) &&
    sameReaderPlace(state.entries.at(-1) ?? null, destination);
  return beginJump(
    state,
    origin,
    destination,
    back,
    "note" in destination && destination.note === true,
    scope,
  );
}
