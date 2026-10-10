export type NavigationScope = {
  accountId: string | null;
  libraryItemId: string;
  finalContentId: string;
  readerFingerprint: string;
};
export function sameNavigationScope(
  left: NavigationScope | undefined,
  right: NavigationScope | undefined,
) {
  if (!left || !right) return left === right;
  return (
    left.accountId === right.accountId &&
    left.libraryItemId === right.libraryItemId &&
    left.finalContentId === right.finalContentId &&
    left.readerFingerprint === right.readerFingerprint
  );
}
