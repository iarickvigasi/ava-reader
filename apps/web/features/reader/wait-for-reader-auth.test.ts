import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReaderAuthInput } from "@/components/app/reader/data/reader-auth";
import { waitForReaderAuth } from "./wait-for-reader-auth";

const ready: ReaderAuthInput = {
  getToken: async () => "token",
  isLoaded: true,
  isSignedIn: true,
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("returns ready auth immediately without leaving a timer or listener", async () => {
  const { signal } = new AbortController();
  const removeListener = vi.spyOn(signal, "removeEventListener");
  expect(await waitForReaderAuth(() => ready, signal)).toBe(ready);
  expect(vi.getTimerCount()).toBe(0);
  expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
});

it("returns the latest auth snapshot when boot finishes", async () => {
  let current = { ...ready, isLoaded: false };
  const { signal } = new AbortController();
  const pending = waitForReaderAuth(() => current, signal);
  await vi.advanceTimersByTimeAsync(100);
  current = ready;
  await vi.advanceTimersByTimeAsync(100);
  expect(await pending).toBe(ready);
  expect(vi.getTimerCount()).toBe(0);
});

it("stops waiting after 2.5 seconds even when auth has not booted", async () => {
  const current = { ...ready, isLoaded: false };
  const { signal } = new AbortController();
  const pending = waitForReaderAuth(() => current, signal);
  const settled = vi.fn();
  void pending.then(settled);
  await vi.advanceTimersByTimeAsync(2_499);
  expect(settled).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(await pending).toBe(current);
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels a pending wait immediately and stops polling", async () => {
  const controller = new AbortController();
  const removeListener = vi.spyOn(controller.signal, "removeEventListener");
  const readAuth = vi.fn(() => ({ ...ready, isLoaded: false }));
  const pending = waitForReaderAuth(readAuth, controller.signal);
  const reason = new Error("Reader closed");
  const rejection = expect(pending).rejects.toBe(reason);
  controller.abort(reason);
  await rejection;
  expect(vi.getTimerCount()).toBe(0);
  expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  await vi.advanceTimersByTimeAsync(3_000);
  expect(readAuth).toHaveBeenCalledTimes(1);
});

it("rejects an already cancelled attempt without reading auth", async () => {
  const controller = new AbortController();
  controller.abort();
  const readAuth = vi.fn(() => ready);
  await expect(waitForReaderAuth(readAuth, controller.signal)).rejects.toBe(
    controller.signal.reason,
  );
  expect(readAuth).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
