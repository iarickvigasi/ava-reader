import type { NavigationQa, QaAck, QaView } from "./protocol";
import { parseQaCommand } from "./parse-command";
import { createFaultGate } from "./fault-gate";
import { qaSnapshot } from "./qa-snapshot";
import { createQaExecution } from "./qa-execution";
import { handleQaCommand } from "./handle-command";
export function createNavigationQa(): NavigationQa {
  const view: QaView = {
    session: null,
    scope: null,
    accountScope: crypto.randomUUID(),
    loadedChapterIds: [],
  };
  let send: ((ack: QaAck) => void) | null = null;
  let active = false;
  let commandId = "session";
  const emit = (phase: string, ok = true, reason?: string) => {
    const ack = qaSnapshot(view, commandId, ok, phase, reason);
    if (active && ack) send?.(ack);
  };
  const gate = createFaultGate((phase, command, sequence) => {
    const ack = qaSnapshot(view, command.commandId, true, phase);
    if (active && ack)
      send?.({
        ...ack,
        stage: command.stage,
        target: command.target,
        sequence: sequence ?? ack.sequence,
      });
  });
  const current = (sequence: number) =>
    active && view.session?.inspect().state.pending?.sequence === sequence;
  return {
    bind: (session, scope, loadedChapterIds) => {
      view.session = session;
      view.scope = scope;
      view.loadedChapterIds = [...loadedChapterIds];
    },
    connect: (next) => {
      send = next;
      active = true;
      emit("connected");
      return () => {
        active = false;
        gate.clear();
        send = null;
      };
    },
    ...createQaExecution(
      view,
      gate,
      current,
      () => emit("state"),
      (success) => {
        const ack = qaSnapshot(view, commandId, true, "restore-observed");
        if (active && ack)
          send?.({ ...ack, stage: "restore", actualRestoreSuccess: success });
      },
    ),
    receive: (value) => {
      const command = parseQaCommand(value);
      if (!active) return;
      if (!command) {
        if (
          typeof value === "object" &&
          value &&
          "type" in value &&
          value.type === "command" &&
          "commandId" in value &&
          typeof value.commandId === "string" &&
          value.commandId.length <= 500
        ) {
          commandId = value.commandId;
          emit("rejected", false, "Malformed command.");
        }
        return;
      }
      commandId = command.commandId;
      const reason = handleQaCommand(view, gate, command);
      emit(
        reason
          ? "rejected"
          : command.action.startsWith("arm-")
            ? "armed"
            : command.action,
        !reason,
        reason ?? undefined,
      );
    },
  };
}
