import type { ReaderLocator } from "@/lib/api-types";
import type { RestoreIntent } from "./navigation";
import {
  beginJump,
  emptyJumpHistory,
  finishJump,
  type JumpRequest,
} from "./jump-history";
import { matchesJump } from "./matches-jump";
import { JUMP_RETURNING, JUMP_RESTORED } from "./jump-messages";
import { rollbackJump } from "./rollback-jump";
import { sameReaderPlace } from "./jump-target";
import type { JumpSessionEffects } from "./jump-session-types";
export function createJumpSession(effects: JumpSessionEffects) {
  let state = emptyJumpHistory();
  let error: string | null = null;
  let active = true;
  function publish(message: string | null) {
    error = message;
    effects.publish(state, error);
  }
  function send(request: JumpRequest) {
    void Promise.resolve()
      .then(() => {
        if (active && state.pending?.sequence === request.sequence)
          return effects.navigate(request.destination, request.sequence);
      })
      .catch(() => {
        if (active && state.pending?.sequence === request.sequence) fail();
      });
  }
  function restoreOrigin(message: string | null) {
    state = rollbackJump(state);
    publish(message);
    if (state.pending) send(state.pending);
  }
  function fail() {
    if (!state.pending) return;
    if (!state.pending.rollback) {
      restoreOrigin(JUMP_RETURNING);
      return;
    }
    state = finishJump(state, state.sequence, false);
    effects.leave();
    publish("Your previous passage could not be restored.");
  }
  function jump(
    destination: ReaderLocator,
    origin = effects.origin(),
    returning = false,
  ) {
    if (!active || !origin) return;
    origin = state.pending?.origin ?? origin;
    if (sameReaderPlace(origin, destination)) {
      if (state.pending) restoreOrigin(null);
      else effects.focus(destination);
      return;
    }
    const back =
      returning && sameReaderPlace(state.entries.at(-1) ?? null, destination);
    state = beginJump(
      state,
      origin,
      destination,
      back,
      "note" in destination && destination.note === true,
    );
    publish(null);
    if (state.pending) send(state.pending);
  }
  function settle(intent: RestoreIntent, success: boolean) {
    const pending = state.pending;
    if (!active || !matchesJump(pending, intent)) return;
    if (!success) {
      fail();
      return;
    }
    state = finishJump(state, pending.sequence, true);
    effects.arrive(pending.destination);
    effects.focus(pending.destination);
    publish(pending.rollback && error ? JUMP_RESTORED : null);
  }
  return {
    jump,
    settle,
    update: (next: JumpSessionEffects) => (effects = next),
    back: () => {
      const target = state.entries.at(-1);
      if (target && !state.pending) jump(target, undefined, true);
    },
    pending: () => !!state.pending,
    activate: () => {
      active = true;
    },
    dispose: () => {
      active = false;
      state = { ...state, pending: null };
    },
  };
}
