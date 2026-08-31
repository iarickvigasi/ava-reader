import { describe, expect, it, vi } from "vitest";
import { createPressTimer } from "./create-press-timer";

function createFakeWin() {
  let nextId = 1;
  const pending = new Map<number, () => void>();

  const win = {
    setTimeout: ((run: () => void) => {
      const id = nextId++;
      pending.set(id, run);
      return id;
    }) as Window["setTimeout"],
    clearTimeout: ((id?: number) => {
      if (id !== undefined) {
        pending.delete(id);
      }
    }) as Window["clearTimeout"],
  } as unknown as Window;

  return {
    win,
    flush() {
      const runs = [...pending.values()];
      pending.clear();
      for (const run of runs) {
        run();
      }
    },
  };
}

describe("createPressTimer", () => {
  it("fires once the finger has rested", () => {
    const { win, flush } = createFakeWin();
    const onPress = vi.fn();

    createPressTimer(win, onPress).arm(10, 20);
    flush();

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("reports where the finger went down", () => {
    const { win } = createFakeWin();
    const press = createPressTimer(win, vi.fn());

    press.arm(10, 20);

    expect(press.origin()).toEqual({ x: 10, y: 20 });
  });

  it("gives up when the finger drifts — that gesture is a page swipe", () => {
    const { win, flush } = createFakeWin();
    const onPress = vi.fn();
    const press = createPressTimer(win, onPress);

    press.arm(10, 20);
    press.cancelIfDrifted(40, 20);
    flush();

    expect(onPress).not.toHaveBeenCalled();
  });

  it("keeps waiting through the jitter of a finger holding still", () => {
    const { win, flush } = createFakeWin();
    const onPress = vi.fn();
    const press = createPressTimer(win, onPress);

    press.arm(10, 20);
    press.cancelIfDrifted(15, 24);
    flush();

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("drops a pending press when cancelled outright", () => {
    const { win, flush } = createFakeWin();
    const onPress = vi.fn();
    const press = createPressTimer(win, onPress);

    press.arm(10, 20);
    press.cancel();
    flush();

    expect(onPress).not.toHaveBeenCalled();
  });
});
