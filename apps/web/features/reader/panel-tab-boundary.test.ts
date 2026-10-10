import { expect, it } from "vitest";
import { tabFixture } from "./panel-tab-test-fixture";

it("wraps reverse from the visible Close to the last panel control", () => {
  const f = tabFixture(), key = f.event({ shiftKey: true });
  f.apply(key);
  expect(key.preventDefault).toHaveBeenCalledOnce();
  expect(f.doc.activeElement).toBe(f.last);
});
it("wraps forward from the last control to Close", () => {
  const f = tabFixture(), key = f.event();
  f.doc.activeElement = f.last;
  f.apply(key);
  expect(key.preventDefault).toHaveBeenCalledOnce();
  expect(f.doc.activeElement).toBe(f.close);
});
it.each([false, true])("leaves intermediate native Tab movement alone (%s)", (shiftKey) => {
  const f = tabFixture(), key = f.event({ shiftKey });
  f.doc.activeElement = f.middle;
  f.apply(key);
  expect(key.preventDefault).not.toHaveBeenCalled();
  expect(f.doc.activeElement).toBe(f.middle);
});
it.each([{ key: "Escape" }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { defaultPrevented: true }])(
  "preserves handled keys and browser shortcuts %j", (override) => {
    const f = tabFixture(), key = f.event({ shiftKey: true, ...override });
    f.apply(key);
    expect(key.preventDefault).not.toHaveBeenCalled();
    expect(f.dialog.querySelectorAll).not.toHaveBeenCalled();
  },
);
it("does not steal focus from a new scope or a closed/disconnected dialog", () => {
  const f = tabFixture();
  f.doc.activeElement = {};
  f.apply(f.event());
  f.doc.activeElement = f.close;
  f.dialog.open = false;
  f.apply(f.event({ shiftKey: true }));
  f.dialog.open = true; f.dialog.isConnected = false;
  f.apply(f.event({ shiftKey: true }));
  expect(f.last.focus).not.toHaveBeenCalled();
});
it.each([false, true])("keeps a single-control panel reachable (%s)", (shiftKey) => {
  const f = tabFixture(), key = f.event({ shiftKey });
  f.candidates.splice(1);
  f.apply(key);
  expect(key.preventDefault).toHaveBeenCalledOnce();
  expect(f.doc.activeElement).toBe(f.close);
});
it("keeps programmatic non-sequential focus inside the panel", () => {
  const f = tabFixture();
  f.middle.tabIndex = -1; f.doc.activeElement = f.middle;
  f.apply(f.event());
  expect(f.doc.activeElement).toBe(f.close);
  f.doc.activeElement = f.middle;
  f.apply(f.event({ shiftKey: true }));
  expect(f.doc.activeElement).toBe(f.last);
});
