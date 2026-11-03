// @vitest-environment jsdom
import { expect, it } from "vitest";
import {
  load,
  loaded,
  mount,
  read,
  setReachable,
  subscriptions,
  unmount,
} from "./reader-loader-test-setup";

it.each([true, false])(
  "keeps an open book's initial payload through recovery (initial reachability: %s)",
  async (online) => {
    await setReachable(online);
    await mount();
    const initial = read();
    expect(initial).toEqual(loaded);
    expect(load).toHaveBeenCalledTimes(1);
    for (let cycle = 0; cycle < 2; cycle++) {
      await setReachable(false);
      await setReachable(true);
      expect(read()).toBe(initial);
      expect(load).toHaveBeenCalledTimes(1);
    }
  },
);

it.each(["missing-offline", "error"] as const)(
  "retries a %s opening on recovery, then preserves the loaded reader",
  async (kind) => {
    load.mockResolvedValueOnce(
      kind === "missing-offline" ? { kind, libraryItemId: "book" } : { kind },
    );
    await setReachable(false);
    await mount();
    expect(read()?.kind).toBe(kind);
    await setReachable(true);
    const recovered = read();
    expect(recovered).toEqual(loaded);
    expect(load).toHaveBeenCalledTimes(2);
    await setReachable(false);
    await setReachable(true);
    expect(read()).toBe(recovered);
    expect(load).toHaveBeenCalledTimes(2);
  },
);

it("removes the recovery subscription when an unavailable reader unmounts", async () => {
  load.mockResolvedValueOnce({
    kind: "missing-offline",
    libraryItemId: "book",
  });
  await setReachable(false);
  await mount();
  const unsubscribe = subscriptions.at(-1)!;
  expect(unsubscribe).not.toHaveBeenCalled();
  await unmount();
  expect(unsubscribe).toHaveBeenCalledExactlyOnceWith();
});
