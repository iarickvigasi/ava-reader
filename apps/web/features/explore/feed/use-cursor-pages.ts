import { useState } from "react";

export function useCursorPages(scope: string | null) {
  const [state, setState] = useState<{
    scope: string | null;
    cursors: string[];
  }>({ scope, cursors: [] });
  const cursors = state.scope === scope ? state.cursors : [];
  return {
    cursor: cursors.at(-1),
    hasPrevious: cursors.length > 0,
    next: (cursor?: string | null) => {
      if (cursor) setState({ scope, cursors: [...cursors, cursor] });
    },
    previous: () => setState({ scope, cursors: cursors.slice(0, -1) }),
  };
}
