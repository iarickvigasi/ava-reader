import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReaderSelection } from "../types";
import { createSelectionCapture } from "./create-selection-capture";

// isInsideReader checks `target instanceof Node`; the node test env has no
// DOM globals, so event targets are FakeNode instances and Node is stubbed.
class FakeNode {
  editable = false;
  closest() {
    return this.editable ? this : null;
  }
}

function createFakeWin(getSelection: () => Selection | null) {
  let nextId = 1;
  const pending = new Map<number, () => void>();
  const windowListeners = new Map<string, Set<() => void>>();

  const win = {
    addEventListener: (type: string, listener: () => void) => {
      const set = windowListeners.get(type) ?? new Set();
      set.add(listener);
      windowListeners.set(type, set);
    },
    removeEventListener: (type: string, listener: () => void) => {
      windowListeners.get(type)?.delete(listener);
    },
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
    dispatchWindow: (type: string) => {
      for (const listener of windowListeners.get(type) ?? []) listener();
    },
    windowListenerCount: () =>
      [...windowListeners.values()].reduce((sum, set) => sum + set.size, 0),
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

  const body = new FakeNode();
  const doc = {
    body,
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
    body,
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
  vi.stubGlobal("Element", FakeNode);

  const insideNode = new FakeNode();
  const outsideNode = new FakeNode();
  const container = {
    contains: (node: unknown) => node === insideNode,
  } as unknown as HTMLElement;

  const removeAllRanges = vi.fn();
  const selection = {
    anchorNode: insideNode,
    anchorOffset: 0,
    focusNode: insideNode,
    focusOffset: 0,
    rangeCount: 1,
    isCollapsed: false,
    toString: () => "selected words",
    getRangeAt: () => ({ commonAncestorContainer: insideNode }),
    removeAllRanges,
  } as unknown as Selection;

  const fakeWin = createFakeWin(() => selection);
  const fakeDoc = createFakeDoc();
  const captures: ReaderSelection[] = [];
  let activeContainer: HTMLElement | null = container;

  const capture = createSelectionCapture({
    win: fakeWin.win,
    doc: fakeDoc.doc,
    getContainer: () => activeContainer,
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
    selection,
    setContainer: (next: HTMLElement | null) => {
      activeContainer = next;
    },
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

describe("keyboard selection capture", () => {
  function extend(t: ReturnType<typeof setup>) {
    t.dispatch("keydown", {
      key: "ArrowRight",
      shiftKey: true,
      target: t.insideNode,
    });
    (t.selection as unknown as { focusOffset: number }).focusOffset += 5;
  }
  function release(t: ReturnType<typeof setup>) {
    t.dispatch("keyup", { key: "Shift", target: t.insideNode });
    t.flush();
  }
  it("waits until Shift release instead of interrupting each extension, then captures once", () => {
    const t = setup();
    extend(t);
    t.dispatch("keyup", { key: "ArrowRight", target: t.insideNode });
    t.flush();
    expect(t.captures).toEqual([]);
    extend(t);
    release(t);
    release(t);
    expect(t.captures.map((c) => c.pointer)).toEqual(["keyboard"]);
    expect(t.removeAllRanges).not.toHaveBeenCalled();
  });
  it("ignores Shift alone and unchanged endpoints", () => {
    const t = setup();
    release(t);
    t.dispatch("keydown", {
      key: "ArrowRight",
      shiftKey: true,
      target: t.insideNode,
    });
    release(t);
    expect(t.captures).toEqual([]);
  });
  it("ignores editable controls and an outside gesture despite a lingering reader range", () => {
    const t = setup();
    t.insideNode.editable = true;
    extend(t);
    release(t);
    t.insideNode.editable = false;
    t.dispatch("keydown", {
      key: "ArrowRight",
      shiftKey: true,
      target: t.outsideNode,
    });
    (t.selection as unknown as { focusOffset: number }).focusOffset += 5;
    release(t);
    expect(t.captures).toEqual([]);
  });
  it("rejects an empty, collapsed range at settlement", () => {
    const t = setup();
    extend(t);
    (t.selection as unknown as { isCollapsed: boolean }).isCollapsed = true;
    release(t);
    expect(t.captures).toEqual([]);
  });
  it("rejects a changed or masked reader container", () => {
    const t = setup();
    extend(t);
    t.setContainer(null);
    release(t);
    expect(t.captures).toEqual([]);
  });
  it("cancels when focus leaves, the document hides, or a pointer gesture intervenes", () => {
    const t = setup();
    extend(t);
    t.dispatch("keydown", { key: "Tab", target: t.outsideNode });
    release(t);
    extend(t);
    t.dispatch("visibilitychange");
    release(t);
    extend(t);
    t.dispatch("pointerdown");
    release(t);
    expect(t.captures).toEqual([]);
  });
  it("supports native caret keys targeted at body only when reader endpoints change", () => {
    const t = setup();
    t.dispatch("keydown", {
      key: "ArrowRight",
      shiftKey: true,
      target: t.body,
    });
    (t.selection as unknown as { focusOffset: number }).focusOffset += 5;
    t.dispatch("keyup", { key: "Shift", target: t.body });
    t.flush();
    expect(t.captures.map((c) => c.pointer)).toEqual(["keyboard"]);
  });
  it("cancels an already scheduled capture if a pointer arrives before settlement", () => {
    const t = setup();
    extend(t);
    t.dispatch("keyup", { key: "Shift", target: t.insideNode });
    t.dispatch("pointerdown");
    t.flush();
    expect(t.captures).toEqual([]);
  });
  it("cancels queued capture on actual outside focusin before the settle timer", () => {
    const t = setup();
    extend(t);
    t.dispatch("keyup", { key: "Shift", target: t.insideNode });
    t.dispatch("focusin", { target: t.outsideNode });
    t.flush();
    expect(t.captures).toEqual([]);
  });
  it("cancels queued capture if focus enters an editable reader control", () => {
    const t = setup();
    extend(t);
    t.dispatch("keyup", { key: "Shift", target: t.insideNode });
    t.insideNode.editable = true;
    t.dispatch("focusin", { target: t.insideNode });
    t.flush();
    expect(t.captures).toEqual([]);
  });
  it("cancels queued capture on window blur and removes the listener on destruction", () => {
    const t = setup();
    extend(t);
    t.dispatch("keyup", { key: "Shift", target: t.insideNode });
    t.dispatchWindow("blur");
    t.flush();
    expect(t.captures).toEqual([]);
    expect(t.windowListenerCount()).toBe(1);
    t.capture.destroy();
    expect(t.windowListenerCount()).toBe(0);
  });
  it("preserves touch priority and cancels pending keyboard capture on destruction", () => {
    const t = setup();
    t.dispatch("touchend", { target: t.insideNode });
    t.flush();
    extend(t);
    release(t);
    expect(t.captures.map((c) => c.pointer)).toEqual(["touch"]);
    const u = setup();
    extend(u);
    u.dispatch("keyup", { key: "Shift", target: u.insideNode });
    u.capture.destroy();
    u.flush();
    expect(u.captures).toEqual([]);
    expect(u.listenerCount()).toBe(0);
  });
});
