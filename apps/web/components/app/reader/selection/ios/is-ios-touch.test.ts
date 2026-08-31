import { describe, expect, it } from "vitest";
import { isIosTouch } from "./is-ios-touch";

function createWin(userAgent: string, maxTouchPoints: number): Window {
  return { navigator: { userAgent, maxTouchPoints } } as unknown as Window;
}

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 Version/26.5.2 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.5 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36";

describe("isIosTouch", () => {
  it("recognizes an iPhone", () => {
    expect(isIosTouch(createWin(IPHONE, 5))).toBe(true);
  });

  it("recognizes an iPad behind its desktop user agent", () => {
    expect(isIosTouch(createWin(IPAD_AS_MAC, 5))).toBe(true);
  });

  it("leaves a real Mac alone — same user agent, no touch", () => {
    expect(isIosTouch(createWin(IPAD_AS_MAC, 0))).toBe(false);
  });

  it("leaves Android alone: the native selection works there", () => {
    expect(isIosTouch(createWin(ANDROID, 5))).toBe(false);
  });
});
