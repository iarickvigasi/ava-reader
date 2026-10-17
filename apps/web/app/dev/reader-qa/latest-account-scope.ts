type Scope = {
  libraryItemId: string;
  finalContentId: string;
  readerFingerprint: string;
};
export function latestAccountScope(receipts: unknown[], scope: Scope) {
  for (const row of [...receipts].reverse()) {
    const ack = row as {
      type?: string;
      ok?: boolean;
      scope?: Scope & { accountScope?: string };
    };
    if (ack?.type !== "ack" || !ack.ok || !ack.scope) continue;
    if (
      Object.entries(scope).some(
        ([key, value]) => ack.scope?.[key as keyof Scope] !== value,
      )
    )
      continue;
    if (
      typeof ack.scope.accountScope === "string" &&
      ack.scope.accountScope.length <= 500
    )
      return ack.scope.accountScope;
  }
  return null;
}
