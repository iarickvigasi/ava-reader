// @vitest-environment jsdom
import { expect, it } from "vitest";
import {
  load,
  loaded,
  mount,
  read,
  setAuthReady,
} from "./reader-loader-test-setup";

it("retries a failed uncached opening when authentication finishes late", async () => {
  await setAuthReady(false);
  load.mockResolvedValueOnce({ kind: "error" });
  await mount();
  expect(read()).toEqual({ kind: "error" });
  await setAuthReady(true);
  expect(read()).toEqual(loaded);
  expect(load).toHaveBeenCalledTimes(2);
});

it("keeps a cached payload and current page through authentication recovery", async () => {
  await setAuthReady(false);
  await mount();
  const initial = read();
  await setAuthReady(true);
  await setAuthReady(false);
  await setAuthReady(true);
  expect(read()).toBe(initial);
  expect(load).toHaveBeenCalledOnce();
});
