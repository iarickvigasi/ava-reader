// @vitest-environment jsdom
import { act } from "react";
import { expect, it } from "vitest";
import type { ReaderLoadResult } from "@/features/reader/load-reader-for-slug";
import { __setNetStateForTests } from "@/features/offline/net/net-state";
import {
  load,
  loaded,
  mount,
  notice,
  read,
  setReachable,
  unmount,
} from "./reader-loader-test-setup";

it("aborts an unfinished opening on unmount", async () => {
  let finish!: (result: ReaderLoadResult) => void;
  load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  const { signal } = load.mock.calls[0][0];
  expect(signal.aborted).toBe(false);
  await unmount();
  expect(signal.aborted).toBe(true);
  await act(async () =>
    finish({ kind: "missing-offline", libraryItemId: "book" }),
  );
  expect(notice).not.toHaveBeenCalled();
});

it("aborts a superseded attempt and ignores its late unavailable result", async () => {
  let finish!: (result: ReaderLoadResult) => void;
  load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await setReachable(false);
  await mount();
  const { signal } = load.mock.calls[0][0];
  await setReachable(true);
  expect(signal.aborted).toBe(true);
  const recovered = read();
  expect(recovered).toEqual(loaded);
  await act(async () =>
    finish({ kind: "missing-offline", libraryItemId: "book" }),
  );
  expect(read()).toBe(recovered);
  expect(notice).not.toHaveBeenCalled();
});

it("keeps the first payload when opening and recovery complete in the same batch", async () => {
  let finish!: (result: ReaderLoadResult) => void;
  load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await setReachable(false);
  await mount();
  expect(read()).toBeNull();
  await act(async () => {
    finish(loaded);
    __setNetStateForTests(true);
  });
  expect(read()).toBe(loaded);
  expect(load).toHaveBeenCalledTimes(1);
});
