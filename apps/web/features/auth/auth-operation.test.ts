import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAuthOperation } from "./auth-operation";
import { AUTH_TIMEOUT_MS } from "./with-deadline";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("does not dispatch an unloaded SDK or overlapping repeated actions", async () => {
  let finish!: () => void;
  const changed = vi.fn(),
    failed = vi.fn(),
    work = vi.fn(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
  const operation = createAuthOperation(false, changed, failed);
  await operation.run(false, work);
  expect(work).not.toHaveBeenCalled();
  operation.setReady(true);
  const first = operation.run(true, work);
  await operation.run(true, work);
  expect(work).toHaveBeenCalledTimes(1);
  finish();
  await first;
  expect(changed.mock.calls.flat()).toEqual(["pending", "idle"]);
});

it("keeps a stalled unabortable attempt locked even after late resolution", async () => {
  let finish!: () => void;
  const changed = vi.fn(),
    failed = vi.fn();
  const operation = createAuthOperation(true, changed, failed);
  const first = operation.run(
    true,
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  vi.advanceTimersByTime(AUTH_TIMEOUT_MS);
  expect(changed).toHaveBeenLastCalledWith("timed-out");
  expect(operation.current()).toBe(false);
  const repeat = vi.fn(async () => {});
  await operation.run(true, repeat);
  finish();
  await first;
  await operation.run(true, repeat);
  expect(repeat).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalledWith("idle");
  expect(failed).not.toHaveBeenCalled();
});

it("catches a rejected SDK operation and reports a settled recoverable failure", async () => {
  const changed = vi.fn(),
    failed = vi.fn();
  const operation = createAuthOperation(true, changed, failed);
  await operation.run(true, async () => {
    throw new Error("private SDK details");
  });
  expect(failed).toHaveBeenCalledTimes(1);
  expect(changed.mock.calls.flat()).toEqual(["pending", "idle"]);
  const retry = vi.fn(async () => {});
  await operation.run(true, retry);
  expect(retry).toHaveBeenCalledTimes(1);
});

it("clears timers and suppresses late UI work after unmount/readiness loss", async () => {
  let finish!: () => void;
  const changed = vi.fn(),
    failed = vi.fn();
  const operation = createAuthOperation(true, changed, failed);
  const first = operation.run(
    true,
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  operation.setReady(false);
  expect(operation.canCall()).toBe(false);
  operation.dispose();
  expect(vi.getTimerCount()).toBe(0);
  finish();
  await first;
  expect(changed.mock.calls.flat()).toEqual(["pending"]);
  expect(operation.current()).toBe(false);
});

it("a remounted pending controller cannot accept a stale result or new attempt", async () => {
  let finish!: () => void;
  const changed = vi.fn(),
    failed = vi.fn();
  const operation = createAuthOperation(true, changed, failed);
  const pending = operation.run(
    true,
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  operation.dispose();
  operation.mount();
  expect(changed).toHaveBeenLastCalledWith("timed-out");
  expect(operation.current()).toBe(false);
  finish();
  await pending;
  const repeat = vi.fn(async () => {});
  await operation.run(true, repeat);
  expect(repeat).not.toHaveBeenCalled();
  expect(failed).not.toHaveBeenCalled();
});
