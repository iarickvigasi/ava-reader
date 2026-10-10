import { matchesJump } from "../matches-jump";
import type { JumpSessionEffects } from "../jump-session-types";
import type { QaSession, QaView } from "./protocol";
import type { createFaultGate } from "./fault-gate";
export function createQaExecution(
  view: QaView,
  gate: ReturnType<typeof createFaultGate>,
  current: (sequence: number) => boolean,
  publish: () => void,
  observed: (success: boolean) => void,
): {
  wrap: (effects: JumpSessionEffects) => JumpSessionEffects;
  settle: QaSession["settle"];
} {
  return {
    wrap: (effects) => ({
      ...effects,
      navigate: (target, sequence) =>
        gate.run(
          "navigate",
          target,
          sequence,
          () => current(sequence),
          () => effects.navigate(target, sequence),
        ),
      publish: (state, error) => {
        effects.publish(state, error);
        publish();
      },
    }),
    settle: (intent, success) => {
      const pending = view.session?.inspect().state.pending;
      if (!pending || !matchesJump(pending, intent)) return;
      observed(success);
      void gate
        .run(
          "restore",
          pending.destination,
          pending.sequence,
          () => current(pending.sequence),
          () => view.session?.settle(intent, success),
        )
        .catch(() => {
          if (current(pending.sequence)) view.session?.settle(intent, false);
        });
    },
  };
}
