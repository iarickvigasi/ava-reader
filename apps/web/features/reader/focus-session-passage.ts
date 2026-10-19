import type { ReaderLocator } from "@/lib/api-types";
import type { JumpSessionContext } from "./jump-session-context";
import { sameNavigationScope } from "./navigation-scope";
export function focusSessionPassage(
  context: JumpSessionContext,
  target: ReaderLocator,
) {
  const { sequence } = context.state;
  const scope = context.effects.scope;
  context.effects.focus(
    target,
    () =>
      context.active &&
      !context.state.pending &&
      context.state.sequence === sequence &&
      sameNavigationScope(context.effects.scope, scope),
  );
}
