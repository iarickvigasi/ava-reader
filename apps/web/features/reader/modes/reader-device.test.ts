import { describe, expect, it } from "vitest";
import { resolveReaderDevice } from "./use-reader-device";

describe("reader device mode", () => {
  it("uses physical phone orientation independently of viewport resizing", () => {
    const screen = { coarse: true, width: 390, height: 844 };
    expect(
      resolveReaderDevice({ ...screen, orientation: "portrait-primary" }),
    ).toBe("phone-portrait");
    expect(
      resolveReaderDevice({ ...screen, orientation: "landscape-secondary" }),
    ).toBe("phone-landscape");
    expect(resolveReaderDevice({ ...screen, angle: -90 })).toBe(
      "phone-landscape",
    );
  });
  it("keeps tablets and touch laptops on the manual mode", () => {
    expect(
      resolveReaderDevice({ coarse: true, width: 1024, height: 768 }),
    ).toBe("desktop");
    expect(
      resolveReaderDevice({ coarse: false, width: 500, height: 300 }),
    ).toBe("desktop");
  });
});
