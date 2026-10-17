import type { NavigationScope } from "../navigation-scope";
import type { QaAck, QaScope, QaView } from "./protocol";
export function qaSnapshot(
  view: QaView,
  commandId: string,
  ok: boolean,
  phase: string,
  reason?: string,
): QaAck | null {
  if (!view.session || !view.scope) return null;
  const { state, origin } = view.session.inspect();
  const publicScope = (scope: NavigationScope): QaScope => ({
    libraryItemId: scope.libraryItemId,
    finalContentId: scope.finalContentId,
    readerFingerprint: scope.readerFingerprint,
    accountScope:
      scope.accountId === view.scope!.accountId
        ? view.accountScope
        : "foreign-account",
  });
  const pending = state.pending
    ? { ...state.pending, originScope: undefined }
    : null;
  return structuredClone({
    type: "ack",
    commandId,
    ok,
    phase,
    reason,
    scope: publicScope(view.scope),
    sequence: state.sequence,
    pending,
    origin,
    history: state.entries,
    historyScopes: state.entryScopes.map((scope) =>
      scope ? publicScope(scope) : null,
    ),
    loadedChapterIds: view.loadedChapterIds,
  });
}
