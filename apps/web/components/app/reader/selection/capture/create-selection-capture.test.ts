import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReaderSelection } from "../types";
import { createSelectionCapture } from "./create-selection-capture";

// isInsideReader checks `target instanceof Node`; the node test env has no
// DOM globals, so event targets are FakeNode instances and Node is stubbed.
class FakeNode {}

function createFakeWin(getSelection: () => Selection | null) {
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
    getSelection,
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

function createFakeDoc() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();

  const doc = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.get(type)?.delete(listener);
    },
  } as unknown as Document;

  return {
    doc,
    dispatch(type: string, event: unknown = {}) {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener(event);
      }
    },
    listenerCount: () =>
      [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

function setup() {
  vi.stubGlobal("Node", FakeNode);

  const insideNode = new FakeNode();
  const outsideNode = new FakeNode();
  const container = {
    contains: (node: unknown) => node === insideNode,
  } as unknown as HTMLElement;

  const removeAllRanges = vi.fn();
  const selection = {
    rangeCount: 1,
    isCollapsed: false,
    toString: () => "selected words",
    getRangeAt: () => ({ commonAncestorContainer: insideNode }),
    removeAllRanges,
  } as unknown as Selection;

  const fakeWin = createFakeWin(() => selection);
  const fakeDoc = createFakeDoc();
  const captures: ReaderSelection[] = [];

  const capture = createSelectionCapture({
    win: fakeWin.win,
    doc: fakeDoc.doc,
    getContainer: () => container,
    onCapture: (readerSelection) => captures.push(readerSelection),
  });

  return {
    ...fakeWin,
    ...fakeDoc,
    capture,
    captures,
    insideNode,
    outsideNode,
    removeAllRanges,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createSelectionCapture", () => {
  it("does not recapture a touch selection as a synthetic mouse selection", () => {
    const t = setup();
    t.dispatch("touchend", { target: t.insideNode });
    t.flush();
    t.dispatch("mouseup", { target: t.insideNode });
    t.flush();
    expect(t.captures.map((capture) => capture.pointer)).toEqual(["touch"]);
  });
  it("captures a mouse selection and keeps the live selection", () => {
    const t = setup();

    t.dispatch("mouseup", { target: t.insideNode });
    t.flush();

    expect(t.captures.map((c) => c.text)).toEqual(["selected words"]);
    expect(t.captures[0]?.pointer).toBe("mouse");
    expect(t.removeAllRanges).not.toHaveBeenCalled();
  });

  it("captures a touch selection without mutating it", () => {
    const t = setup();

    t.dispatch("touchend", { target: t.insideNode });
    t.flush();

    expect(t.captures.map((c) => c.text)).toEqual(["selected words"]);
    expect(t.captures[0]?.pointer).toBe("touch");
    // The capture only reports; the AI toolbox owns the drop when it opens.
    expect(t.removeAllRanges).not.toHaveBeenCalled();
  });

  it("ignores events whose target is outside the reader", () => {
    const t = setup();

    t.dispatch("mouseup", { target: t.outsideNode });
    t.dispatch("touchend", { target: t.outsideNode });
    t.flush();

    expect(t.captures).toEqual([]);
  });

  it("destroy removes every document listener", () => {
    const t = setup();
    expect(t.listenerCount()).toBeGreaterThan(0);

    t.capture.destroy();

    expect(t.listenerCount()).toBe(0);
  });
});
