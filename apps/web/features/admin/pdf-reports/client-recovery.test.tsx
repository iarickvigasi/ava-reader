import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import {
  authHooks,
  resetAuthHooks,
} from "@/components/auth/auth-readiness-test-hooks";
const sdk = vi.hoisted(() => ({
  auth: {
    isLoaded: true,
    isSignedIn: true,
    userId: "operator",
    sessionId: "session",
  },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  ...(await import("@/components/auth/auth-readiness-test-hooks"))
    .authMockHooks,
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => sdk.auth }));
import { ReportClient } from "@/components/app/admin/pdf-reports/client";
import { ReportStateNotice } from "@/components/app/admin/pdf-reports/state-notice";
import { ReportResult } from "@/components/app/admin/pdf-reports/result";
const search = {
  kind: "conversionId",
  reference: "pdf-1",
  view: "events",
  eventCursor: "after-56",
  costCursor: "cost-1",
};
function find<T>(node: ReactNode, type: unknown): T | undefined {
  if (Array.isArray(node))
    return node.map((child) => find<T>(child, type)).find(Boolean);
  if (!isValidElement<T & { children?: ReactNode }>(node)) return;
  return node.type === type ? node.props : find<T>(node.props.children, type);
}
function render(query = search) {
  authHooks.stateCursor = authHooks.effectCursor = 0;
  const tree = ReportClient({ search: query });
  authHooks.passive.splice(0).forEach((commit) => commit());
  return tree;
}
const notice = (tree: ReactNode) =>
  find<ComponentProps<typeof ReportStateNotice> & { onRetry?: () => void }>(
    tree,
    ReportStateNotice,
  );
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function ready(ownerId = "operator") {
  return Response.json({
    state: "ready",
    ownerId,
    query: search,
    report: { value: { status: "READY" }, omittedFields: 0, nextCursor: null },
  });
}
beforeEach(() => {
  resetAuthHooks();
  vi.useFakeTimers();
  sdk.auth = {
    isLoaded: true,
    isSignedIn: true,
    userId: "operator",
    sessionId: "session",
  };
});
afterEach(() => {
  authHooks.effects.forEach((effect) => effect.cleanup?.());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("rechecks the same session and exact report only after an explicit auth retry", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ state: "signIn" }, { status: 401 }))
    .mockResolvedValueOnce(ready());
  vi.stubGlobal("fetch", request);
  render();
  await flush();
  const denied = notice(render());
  expect(denied?.state).toBe("signIn");
  expect(denied?.query).toEqual(search);
  expect(denied?.onRetry).toBeTypeOf("function");
  await vi.advanceTimersByTimeAsync(60_000);
  render();
  expect(request).toHaveBeenCalledTimes(1);
  denied?.onRetry?.();
  const checking = render();
  expect(find(checking, ReportResult)).toBeUndefined();
  expect(notice(checking)).toBeUndefined();
  await flush();
  expect(find(render(), ReportResult)).toBeDefined();
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenNthCalledWith(
    2,
    request.mock.calls[0][0],
    expect.objectContaining({
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    }),
  );
  expect(request.mock.calls[1][1]?.method ?? "GET").toBe("GET");
});
it("retains a persistent denial without automatic retry or stale private report", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async () =>
      Response.json({ state: "signIn" }, { status: 401 }),
    );
  vi.stubGlobal("fetch", request);
  render();
  await flush();
  notice(render())?.onRetry?.();
  render();
  await flush();
  expect(notice(render())?.state).toBe("signIn");
  expect(find(render(), ReportResult)).toBeUndefined();
  await vi.advanceTimersByTimeAsync(60_000);
  render();
  expect(request).toHaveBeenCalledTimes(2);
});
it.each(["account", "session", "query", "unmount"])(
  "never reveals a late retry result after %s changes",
  async (change) => {
    let resolve!: (value: Response) => void;
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ state: "signIn" }, { status: 401 }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(
        Response.json({ state: "forbidden" }, { status: 403 }),
      );
    vi.stubGlobal("fetch", request);
    render();
    await flush();
    notice(render())?.onRetry?.();
    render();
    if (change === "account") sdk.auth = { ...sdk.auth, userId: "other" };
    if (change === "session")
      sdk.auth = { ...sdk.auth, sessionId: "new-session" };
    const next =
      change === "query" ? { ...search, eventCursor: "after-4" } : search;
    if (change === "unmount")
      authHooks.effects.forEach((effect) => effect.cleanup?.());
    else render(next);
    resolve(ready());
    await flush();
    expect(request.mock.calls[1][1]?.signal?.aborted).toBe(true);
    if (change !== "unmount") {
      expect(find(render(next), ReportResult)).toBeUndefined();
      expect(notice(render(next))?.state).toBe("forbidden");
    }
  },
);
it("preserves the report return context while signed out without trying a server read", () => {
  sdk.auth = { ...sdk.auth, isSignedIn: false };
  const request = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", request);
  const denied = notice(render());
  expect(denied?.query).toEqual(search);
  expect(denied?.onRetry).toBeUndefined();
  expect(request).not.toHaveBeenCalled();
});
