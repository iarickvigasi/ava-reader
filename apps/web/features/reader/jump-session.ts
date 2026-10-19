import type { ReaderLocator } from "@/lib/api-types";
import type { RestoreIntent } from "./navigation";
import { emptyJumpHistory, finishJump, type JumpRequest } from "./jump-history";
import { matchesJump } from "./matches-jump";
import { JUMP_RETURNING, JUMP_RESTORED } from "./jump-messages";
import { rollbackJump } from "./rollback-jump";
import { sameReaderPlace } from "./jump-target";
import { beginSessionJump } from "./begin-session-jump";
import { focusSessionPassage } from "./focus-session-passage";
import { sendJump } from "./send-jump";
import { createJumpSessionControls } from "./jump-session-controls";
import type { JumpSessionContext } from "./jump-session-context";
import type { JumpSessionEffects } from "./jump-session-types";
export function createJumpSession(effects: JumpSessionEffects) {
  const context: JumpSessionContext = {
    state: emptyJumpHistory(),
    error: null,
    active: true,
    effects,
  };
  function publish(message: string | null) {
    context.error = message;
    context.effects.publish(context.state, context.error);
  }
  const send = (request: JumpRequest) =>
    sendJump(
      request,
      () =>
        context.active && context.state.pending?.sequence === request.sequence,
      () => context.effects,
      fail,
    );
  function restoreOrigin(message: string | null, restart = false) {
    context.state = rollbackJump(context.state, restart);
    publish(message);
    if (context.state.pending) send(context.state.pending);
  }
  function fail() {
    if (!context.state.pending) return;
    if (!context.state.pending.rollback) {
      restoreOrigin(JUMP_RETURNING);
      return;
    }
    context.state = finishJump(context.state, context.state.sequence, false);
    context.effects.leave();
    publish("Your previous passage could not be restored.");
  }
  function jump(
    destination: ReaderLocator,
    origin = context.effects.origin(),
    returning = false,
  ) {
    if (!context.active || !origin) return;
    origin = context.state.pending?.origin ?? origin;
    if (sameReaderPlace(origin, destination)) {
      if (context.state.pending) restoreOrigin(null);
      else focusSessionPassage(context, destination);
      return;
    }
    context.state = beginSessionJump(
      context.state,
      origin,
      destination,
      returning,
      context.effects.scope,
    );
    publish(null);
    if (context.state.pending) send(context.state.pending);
  }
  function settle(intent: RestoreIntent, success: boolean) {
    const pending = context.state.pending;
    if (!context.active || !matchesJump(pending, intent)) return;
    if (!success) {
      fail();
      return;
    }
    const destination = context.effects.resolve(pending.destination);
    if (!destination) {
      fail();
      return;
    }
    context.state = finishJump(context.state, pending.sequence, true);
    context.effects.arrive(destination);
    focusSessionPassage(context, destination);
    publish(pending.rollback && context.error ? JUMP_RESTORED : null);
  }
  return createJumpSessionControls(context, {
    jump,
    settle,
    publish,
    restoreOrigin,
  });
}
