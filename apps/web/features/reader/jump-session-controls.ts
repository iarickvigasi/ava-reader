import type { ReaderLocator } from "@/lib/api-types";
import type { RestoreIntent } from "./navigation";
import type { NavigationScope } from "./navigation-scope";
import type { JumpSessionContext } from "./jump-session-context";
import type { JumpSessionEffects } from "./jump-session-types";
import { emptyJumpHistory } from "./jump-history";
import { validateReturn } from "./validate-return";
export function createJumpSessionControls(
  context: JumpSessionContext,
  actions: {
    jump: (
      point: ReaderLocator,
      origin?: ReaderLocator,
      returning?: boolean,
    ) => void;
    settle: (intent: RestoreIntent, success: boolean) => void;
    publish: (error: string | null) => void;
    restoreOrigin: (message: string | null, restart?: boolean) => void;
  },
) {
  return {
    jump: actions.jump,
    settle: actions.settle,
    update: (effects: JumpSessionEffects) => {
      context.effects = effects;
    },
    back: () => {
      const result = validateReturn(context.state, context.effects.scope);
      context.state = result.state;
      if (result.error) actions.publish(result.error);
      else if (result.target && !context.state.pending)
        actions.jump(result.target, undefined, true);
    },
    inspect: () => ({
      state: context.state,
      scope: context.effects.scope,
      origin: context.effects.origin(),
    }),
    cancel: () => {
      if (context.active && context.state.pending)
        actions.restoreOrigin(null, true);
    },
    inject: (point: ReaderLocator, scope: NavigationScope) => {
      if (!context.active) return;
      context.state = {
        ...context.state,
        entries: [...context.state.entries, point],
        entryScopes: [...context.state.entryScopes, scope],
      };
      actions.publish(context.error);
    },
    pending: () => !!context.state.pending,
    activate: () => {
      context.active = true;
      actions.publish(context.error);
    },
    dispose: () => {
      context.active = false;
      context.state = {
        ...emptyJumpHistory(),
        sequence: context.state.sequence + 1,
      };
      context.error = null;
    },
  };
}
