import { sameNavigationScope } from "../navigation-scope";
import type { QaCommand, QaView } from "./protocol";
import type { createFaultGate } from "./fault-gate";
export function handleQaCommand(
  view: QaView,
  gate: ReturnType<typeof createFaultGate>,
  command: QaCommand,
) {
  const { session, scope } = view;
  if (!session || !scope) return "Reader session is unavailable.";
  const requested = { ...command.scope, accountId: scope.accountId };
  if (
    !sameNavigationScope(requested, scope) ||
    ((command.action !== "snapshot" ||
      command.scope.accountScope !== undefined) &&
      command.scope.accountScope !== view.accountScope)
  )
    return "Scope mismatch.";
  if (command.action === "arm-fail" || command.action === "arm-hold")
    return gate.arm(command) ? null : "Release the existing hold first.";
  if (command.action === "release") gate.release();
  if (command.action === "cancel") {
    session.cancel();
    gate.clear();
  }
  if (command.action === "inject-stale") {
    if (session.pending()) return "Wait for the pending request.";
    const entry = {
      ...command.entryScope!,
      accountId:
        command.entryScope?.accountScope &&
        command.entryScope.accountScope !== view.accountScope
          ? "qa:foreign-account"
          : scope.accountId,
    };
    if (sameNavigationScope(entry, scope))
      return "The injected entry must have a different scope.";
    session.inject(command.target!, entry);
  }
  return null;
}
