import { expect, it } from "vitest";
import { tabFixture } from "./panel-tab-test-fixture";

type F = ReturnType<typeof tabFixture>;
function details(summary: F["middle"], open = false) {
  const element = {
    tagName: "DETAILS",
    open,
    parentElement: null as HTMLElement | null,
    children: [summary],
  };
  summary.tagName = "SUMMARY";
  summary.parentElement = element as unknown as HTMLElement;
  Object.assign(summary, { contains: (node: unknown) => node === summary });
  return element;
}

it.each([false, true])(
  "wraps at the actual closed-details summary with positive hidden rectangles (%s)",
  (shiftKey) => {
    const f = tabFixture(),
      section = details(f.middle);
    f.last.parentElement = section as unknown as HTMLElement;
    f.last.focus.mockImplementation(() => {}); // Native focus ignores closed details content.
    expect(f.last.getClientRects()).toHaveLength(1);
    f.doc.activeElement = shiftKey ? f.close : f.middle;
    const key = f.event({ shiftKey });
    f.apply(key);
    expect(key.preventDefault).toHaveBeenCalledOnce();
    expect(f.doc.activeElement).toBe(shiftKey ? f.middle : f.close);
    expect(f.last.focus).not.toHaveBeenCalled();
  },
);

it("restores page buttons when details open and removes them again when closed", () => {
  const f = tabFixture(),
    section = details(f.middle);
  f.last.parentElement = section as unknown as HTMLElement;
  f.apply(f.event({ shiftKey: true }));
  expect(f.doc.activeElement).toBe(f.middle);
  section.open = true;
  f.doc.activeElement = f.close;
  f.apply(f.event({ shiftKey: true }));
  expect(f.doc.activeElement).toBe(f.last);
  section.open = false;
  f.doc.activeElement = f.close;
  f.apply(f.event({ shiftKey: true }));
  expect(f.doc.activeElement).toBe(f.middle);
});

it.each([false, true])(
  "checks an outer closed details even when its inner details open=%s",
  (innerOpen) => {
    const f = tabFixture(),
      outer = details(f.middle),
      innerSummary = f.control();
    const inner = details(innerSummary, innerOpen);
    inner.parentElement = outer as unknown as HTMLElement;
    f.last.parentElement = inner as unknown as HTMLElement;
    f.candidates.splice(2, 0, innerSummary);
    expect(innerSummary.getClientRects()).toHaveLength(1);
    f.apply(f.event({ shiftKey: true }));
    expect(f.doc.activeElement).toBe(f.middle);
    expect(innerSummary.focus).not.toHaveBeenCalled();
    expect(f.last.focus).not.toHaveBeenCalled();
  },
);

it("includes only the first direct summary of a closed details", () => {
  const f = tabFixture(),
    section = details(f.middle);
  f.last.tagName = "SUMMARY";
  f.last.parentElement = section as unknown as HTMLElement;
  section.children.push(f.last);
  f.apply(f.event({ shiftKey: true }));
  expect(f.doc.activeElement).toBe(f.middle);
});
