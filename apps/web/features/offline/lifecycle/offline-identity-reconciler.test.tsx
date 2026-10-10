import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { OfflineIdentityReconciler } from "./offline-identity-reconciler";
import { useMountedDeviceOwner } from "./device-owner-context";

const f = vi.hoisted(() => ({
  owner: "reader-a" as string | null | undefined,
  ready: true,
  blocked: false,
  pathname: "/app/books/book/read",
  gate: true,
}));
vi.mock("next/navigation", () => ({ usePathname: () => f.pathname }));
vi.mock("@/features/auth/use-device-identity", () => ({
  useDeviceIdentity: () => ({
    owner: f.owner,
    ready: f.ready,
    blocked: f.blocked,
  }),
}));
vi.mock("@/features/auth/local-sign-out-recovery", () => ({
  LocalSignOutRecovery: () => null,
}));
vi.mock("../compatibility/database-access-gate", () => ({
  DatabaseAccessGate: ({ children }: { children: React.ReactNode }) =>
    f.gate ? children : <p>Database blocked</p>,
}));
function Probe() {
  const owner = useMountedDeviceOwner();
  return <p>{owner ?? "No owner"}</p>;
}
const render = () =>
  renderToStaticMarkup(
    <OfflineIdentityReconciler serverUserId={null}>
      <Probe />
    </OfflineIdentityReconciler>,
  );
beforeEach(() => {
  f.owner = "reader-a";
  f.ready = f.gate = true;
  f.blocked = false;
  f.pathname = "/app/books/book/read";
});
it("provides the reconciled mounted owner without requiring a Clerk user", () => {
  expect(render()).toBe("<p>reader-a</p>");
});
it("keeps unready identity, explicit sign-out and database gates ahead of local children", () => {
  f.ready = false;
  expect(render()).toBe("");
  f.ready = true;
  f.blocked = true;
  expect(render()).toBe("");
  f.blocked = false;
  f.gate = false;
  expect(render()).toBe("<p>Database blocked</p>");
});
it("has no authority outside the owner provider or for a visitor", () => {
  expect(renderToStaticMarkup(<Probe />)).toBe("<p>No owner</p>");
  f.owner = null;
  expect(render()).toBe("<p>No owner</p>");
});
it("changes the value with the reconciled account while preserving public-route behavior", () => {
  f.owner = "reader-b";
  expect(render()).toBe("<p>reader-b</p>");
  f.pathname = "/";
  f.ready = false;
  f.blocked = true;
  f.gate = false;
  expect(render()).toBe("<p>reader-b</p>");
});
