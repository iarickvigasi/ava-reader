import type { JumpHistory } from "./jump-history";
import { sameNavigationScope, type NavigationScope } from "./navigation-scope";
export function validateReturn(state: JumpHistory, scope?: NavigationScope) {
  const target = state.entries.at(-1);
  if (
    !target ||
    state.pending ||
    sameNavigationScope(state.entryScopes.at(-1), scope)
  )
    return { state, target, error: null };
  return {
    state: {
      ...state,
      entries: state.entries.slice(0, -1),
      entryScopes: state.entryScopes.slice(0, -1),
    },
    target: undefined,
    error:
      "That return belongs to another reading session. Your place has been kept.",
  };
}
