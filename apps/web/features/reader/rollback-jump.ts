import type { JumpHistory } from "./jump-history";
export function rollbackJump(state: JumpHistory): JumpHistory {
  const pending = state.pending;
  if (!pending || pending.rollback) return state;
  const sequence = state.sequence + 1;
  return {
    ...state,
    sequence,
    pending: {
      origin: pending.origin,
      destination: pending.origin,
      sequence,
      back: false,
      rollback: true,
    },
  };
}
