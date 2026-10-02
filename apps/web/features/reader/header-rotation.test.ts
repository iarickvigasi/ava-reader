import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  HEADER_FADE_MS,
  HEADER_ROTATION_MS,
  startHeaderRotation,
} from "./header-rotation";

let visibility: EventTarget & { hidden: boolean };
let reducedMotion: { matches: boolean };
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  visibility = Object.assign(new EventTarget(), { hidden: false });
  reducedMotion = { matches: false };
  vi.stubGlobal("document", visibility);
  vi.stubGlobal("window", { matchMedia: () => reducedMotion });
});

afterEach(() => {
  stop?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("fades out at five minutes and alternates without accumulating fade time", () => {
  const notify = vi.fn();
  stop = startHeaderRotation(notify);
  vi.advanceTimersByTime(HEADER_ROTATION_MS - 1);
  expect(notify).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(notify).toHaveBeenLastCalledWith({ chapter: false, fading: true });
  vi.advanceTimersByTime(HEADER_FADE_MS);
  expect(notify).toHaveBeenLastCalledWith({ chapter: true, fading: false });
  vi.advanceTimersByTime(HEADER_ROTATION_MS - HEADER_FADE_MS);
  expect(notify).toHaveBeenLastCalledWith({ chapter: true, fading: true });
  vi.advanceTimersByTime(HEADER_FADE_MS);
  expect(notify).toHaveBeenLastCalledWith({ chapter: false, fading: false });
});

it("pauses remaining time while hidden and cancels on cleanup", () => {
  const notify = vi.fn();
  stop = startHeaderRotation(notify);
  vi.advanceTimersByTime(120_000);
  visibility.hidden = true;
  visibility.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(600_000);
  expect(notify).not.toHaveBeenCalled();
  visibility.hidden = false;
  visibility.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(180_000);
  expect(notify).toHaveBeenCalledTimes(1);
  stop();
  vi.advanceTimersByTime(HEADER_ROTATION_MS);
  expect(notify).toHaveBeenCalledTimes(1);
});

it("swaps instantly with reduced motion, including when initially hidden", () => {
  visibility.hidden = true;
  reducedMotion.matches = true;
  const notify = vi.fn();
  stop = startHeaderRotation(notify);
  vi.advanceTimersByTime(HEADER_ROTATION_MS);
  expect(notify).not.toHaveBeenCalled();
  visibility.hidden = false;
  visibility.dispatchEvent(new Event("visibilitychange"));
  vi.advanceTimersByTime(HEADER_ROTATION_MS);
  expect(notify).toHaveBeenLastCalledWith({ chapter: true, fading: false });
  vi.advanceTimersByTime(HEADER_ROTATION_MS);
  expect(notify).toHaveBeenLastCalledWith({ chapter: false, fading: false });
});
