import { expect, it } from "vitest";
import { tabFixture } from "./panel-tab-test-fixture";

it.each(["negative", "disabled", "hidden", "noRect", "visibility", "nested"])(
  "skips an ineligible final control (%s)", (kind) => {
    const f = tabFixture(), key = f.event({ shiftKey: true });
    if (kind === "negative") f.last.tabIndex = -1;
    if (kind === "disabled") f.last.disabled = true;
    if (kind === "hidden") f.last.hidden = true;
    if (kind === "noRect") f.last.visible = false;
    if (kind === "visibility") f.last.visibility = "hidden";
    if (kind === "nested") f.last.nested = true;
    f.apply(key);
    expect(f.doc.activeElement).toBe(f.middle);
  },
);
it("skips the full-screen negative-tabindex backdrop before Close", () => {
  const f = tabFixture(), backdrop = f.control();
  backdrop.tabIndex = -1;
  f.candidates.unshift(backdrop);
  f.doc.activeElement = f.last;
  f.apply(f.event());
  expect(f.doc.activeElement).toBe(f.close);
});
it("recomputes candidates when a loading control is disabled", () => {
  const f = tabFixture();
  f.last.disabled = true;
  f.apply(f.event({ shiftKey: true }));
  expect(f.doc.activeElement).toBe(f.middle);
  f.last.disabled = false; f.doc.activeElement = f.close;
  f.apply(f.event({ shiftKey: true }));
  expect(f.doc.activeElement).toBe(f.last);
});
it("follows positive tabindex order while retaining zero-index DOM order", () => {
  const f = tabFixture();
  f.last.tabIndex = 1;
  f.doc.activeElement = f.last;
  f.apply(f.event({ shiftKey: true }));
  expect(f.doc.activeElement).toBe(f.middle);
});
it("retains native dialog focus when no descendant can take Tab", () => {
  const f = tabFixture(), key = f.event();
  f.doc.activeElement = f.dialog; f.candidates.splice(0);
  f.apply(key);
  expect(key.preventDefault).toHaveBeenCalledOnce();
  expect(f.dialog.focus).toHaveBeenCalledOnce();
});
it("leaves a nested dialog's own focus navigation alone", () => {
  const f = tabFixture(), key = f.event();
  f.last.nested = true; f.doc.activeElement = f.last;
  f.apply(key);
  expect(key.preventDefault).not.toHaveBeenCalled();
  expect(f.doc.activeElement).toBe(f.last);
  expect(f.close.focus).not.toHaveBeenCalled();
});
