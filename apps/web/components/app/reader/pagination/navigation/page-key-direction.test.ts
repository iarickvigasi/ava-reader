import { describe, expect, it } from "vitest";
import { pageKeyDirection } from "./page-key-direction";

const plain = {
  key: "ArrowRight",
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  defaultPrevented: false,
};
describe("reader page keys", () => {
  it("keeps ordinary unmodified page turning", () => {
    expect(pageKeyDirection(plain)).toBe("next");
    expect(pageKeyDirection({ ...plain, key: "ArrowLeft" })).toBe("previous");
    expect(pageKeyDirection({ ...plain, key: "ArrowUp" })).toBeNull();
  });
  it.each([
    "shiftKey",
    "ctrlKey",
    "altKey",
    "metaKey",
    "defaultPrevented",
  ] as const)(
    "preserves native selection, word or browser handling for %s",
    (modifier) => {
      expect(pageKeyDirection({ ...plain, [modifier]: true })).toBeNull();
      expect(
        pageKeyDirection({ ...plain, key: "ArrowLeft", [modifier]: true }),
      ).toBeNull();
    },
  );
});
