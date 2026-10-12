import { isValidElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import {
  a,
  b,
  flushRequests,
  jumpFixture,
} from "@/features/reader/jump-session-test-fixture";
import { useJumpScope } from "../state/use-jump-scope";
import { ReaderNavigationSession } from "./reader-navigation-session";
import { ReaderNavigationState } from "./reader-navigation-state";
import type { ReadyReaderProps } from "../shared/types";
const identity = vi.hoisted(() => ({
  userId: "account-one" as string | null | undefined,
  owner: "account-one" as string | null,
}));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({ userId: identity.userId }),
}));
vi.mock("@/features/offline/lifecycle/device-owner-context", () => ({
  useMountedDeviceOwner: () => identity.owner,
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
function propsFor(libraryItemId = "owned-one", content = "accepted-one") {
  const payload = canonicalFixture();
  payload.readerPackage!.final_content_id = content;
  return { payload, libraryItemId } as ReadyReaderProps;
}
const keyFor = (props: ReadyReaderProps) =>
  navigationKey(ReaderNavigationSession(props));
beforeEach(() => {
  identity.userId = identity.owner = "account-one";
});
it("keys navigation to the mounted owner, owned item and immutable content", () => {
  const initial = keyFor(propsFor());
  expect(initial).toBe("account-one:owned-one:accepted-one");
  identity.owner = "account-two";
  const otherOwner = keyFor(propsFor());
  identity.owner = "account-one";
  expect(
    new Set([
      initial,
      otherOwner,
      keyFor(propsFor("owned-two")),
      keyFor(propsFor("owned-one", "accepted-two")),
    ]).size,
  ).toBe(4);
});
it.each([undefined, null])(
  "retains Back through temporarily unavailable Clerk identity (%s) and same-owner reconnect",
  async (unavailable) => {
    const props = propsFor(),
      mountedKey = keyFor(props),
      f = jumpFixture();
    const updateScope = (scope: ReturnType<typeof useJumpScope>) =>
      f.session.update({
        scope,
        origin: () => f.view.origin,
        navigate: f.navigate,
        resolve: (target) => target,
        focus: f.focus,
        arrive: (target) => {
          f.view.origin = target;
        },
        leave: () => {
          f.view.origin = null;
        },
        publish: (state, error) => {
          f.view.state = state;
          f.view.error = error;
        },
      });
    updateScope(useJumpScope(props));
    f.session.jump(b);
    await flushRequests();
    f.session.settle(f.intent(), true);
    expect(f.view.state.entries).toEqual([a]);
    identity.userId = unavailable;
    expect(keyFor(props)).toBe(mountedKey);
    expect(useJumpScope(props).accountId).toBe("account-one");
    updateScope(useJumpScope(props));
    identity.userId = "account-one";
    expect(keyFor(props)).toBe(mountedKey);
    updateScope(useJumpScope(props));
    f.session.back();
    await flushRequests();
    f.session.settle(f.intent(), true);
    expect(f.view.origin).toEqual(a);
    expect(f.view.state.entries).toEqual([]);
    expect(f.view.error).toBeNull();
  },
);
it("changes the navigation mount and scope for a genuine reconciled owner change", () => {
  const props = propsFor(),
    first = keyFor(props),
    scope = useJumpScope(props);
  identity.owner = "account-two";
  // The reconciler gates adoption; the reader follows its mounted owner even if
  // a raw Clerk callback still reports the previous identity for this turn.
  expect(keyFor(props)).not.toBe(first);
  expect(useJumpScope(props).accountId).toBe("account-two");
  expect(useJumpScope(props)).not.toEqual(scope);
});
it("keeps visitor/sign-out distinct from the prior owned session", () => {
  const props = propsFor(),
    first = keyFor(props);
  identity.owner = null;
  expect(keyFor(props)).not.toBe(first);
  expect(useJumpScope(props).accountId).toBeNull();
});
