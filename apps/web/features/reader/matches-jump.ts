import type { JumpRequest } from "./jump-history";
import type { RestoreIntent } from "./navigation";
import { sameReaderPlace } from "./jump-target";
export function matchesJump(
  pending: JumpRequest | null,
  intent: RestoreIntent,
): pending is JumpRequest {
  return (
    !!pending &&
    intent.requestId === pending.sequence &&
    intent.chapterId === pending.destination.chapterId &&
    (pending.destination.blockId
      ? intent.kind === "block" && sameReaderPlace(pending.destination, intent)
      : intent.kind !== "block")
  );
}
