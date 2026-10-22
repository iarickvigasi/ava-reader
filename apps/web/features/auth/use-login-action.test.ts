import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ online: true, values: [] as unknown[] }));
vi.mock("react", () => ({
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => {
    const index = state.values.length;
    state.values.push(value);
    return [
      value,
      (next: unknown) => {
        state.values[index] = next;
      },
    ];
  },
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/offline/net/net-state", () => ({
  isOnline: () => state.online,
}));
import { useLoginAction } from "./use-login-action";
beforeEach(() => {
  state.online = true;
  state.values = [];
});
afterEach(() => vi.useRealTimers());
it("never starts login work offline", async () => {
  state.online = false;
  const action = useLoginAction();
  const work = vi.fn();
  await action.run(work, "tryAgain");
  expect(work).not.toHaveBeenCalled();
  expect(state.values[0]).toBe("offline");
});
it("blocks duplicate submissions and releases a failed action", async () => {
  const action = useLoginAction();
  let reject!: (error: Error) => void;
  const work = vi.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  const pending = action.run(work, "tryAgain");
  await action.run(work, "tryAgain");
  expect(work).toHaveBeenCalledOnce();
  reject(new Error("private provider detail"));
  await pending;
  expect(state.values).toEqual(["tryAgain", false]);
  await action.run(async () => {}, "tryAgain");
  expect(state.values).toEqual([undefined, false]);
});
it("shows a friendly message and releases busy state after a deadline", async () => {
  vi.useFakeTimers();
  const action = useLoginAction();
  const pending = action.run(() => new Promise(() => {}), "sendFailed");
  await vi.advanceTimersByTimeAsync(15_000);
  await pending;
  expect(state.values).toEqual(["sendFailed", false]);
});
