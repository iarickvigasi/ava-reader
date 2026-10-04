import { isValidElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { ReaderNavigationSession } from "./reader-navigation-session";
import { ReaderNavigationState } from "./reader-navigation-state";
import type { ReadyReaderProps } from "../shared/types";
const auth = vi.hoisted(() => ({ userId: "account-one" }));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => auth,
}));
function navigationKey(node: ReactNode): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const key = navigationKey(child);
      if (key) return key;
    }
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  return node.type === ReaderNavigationState
    ? node.key
    : navigationKey(node.props.children);
}
function keyFor(account: string, libraryItemId: string, content: string) {
  auth.userId = account;
  const payload = canonicalFixture();
  payload.readerPackage!.final_content_id = content;
  return navigationKey(
    ReaderNavigationSession({ payload, libraryItemId } as ReadyReaderProps),
  );
}
it("keys the existing navigation state to account, owned item and immutable content", () => {
  const initial = keyFor("account-one", "owned-one", "accepted-one");
  expect(initial).toBe("account-one:owned-one:accepted-one");
  expect(
    new Set([
      initial,
      keyFor("account-two", "owned-one", "accepted-one"),
      keyFor("account-one", "owned-two", "accepted-one"),
      keyFor("account-one", "owned-one", "accepted-two"),
    ]).size,
  ).toBe(4);
});
