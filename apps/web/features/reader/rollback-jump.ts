import type { JumpHistory } from "./jump-history";
export function rollbackJump(state: JumpHistory, restart = false): JumpHistory {
  const pending = state.pending;
  if (!pending || (pending.rollback && !restart)) return state;
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
