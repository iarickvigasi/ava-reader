import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SelectionPlayer } from "./selection-player";

class FakeAudio {
  currentTime = 0;
  onplaying: (() => void) | null = null;
  onwaiting: (() => void) | null = null;
  onended: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => {
    this.onplaying?.();
  });
  pause = vi.fn(() => this.onpause?.());
  load = vi.fn();
  removeAttribute = vi.fn();
}
let audio: FakeAudio;
let player: SelectionPlayer;
beforeEach(() => {
  audio = new FakeAudio();
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        return audio;
      }
    },
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:speech");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  player = new SelectionPlayer();
});
afterEach(() => {
  player.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const load = () => Promise.resolve(new Blob(["audio"], { type: "audio/mpeg" }));
it("shows loading, playing, and idle after end; reuses audio on replay", async () => {
  const loader = vi.fn(load);
  const promise = player.toggle(loader);
  expect(player.snapshot()).toBe("loading");
  await promise;
  expect(player.snapshot()).toBe("playing");
  audio.onwaiting?.();
  expect(player.snapshot()).toBe("loading");
  audio.onplaying?.();
  audio.onended?.();
  expect(player.snapshot()).toBe("idle");
  await player.toggle(loader);
  expect(loader).toHaveBeenCalledTimes(1);
  await player.toggle(loader);
  expect(player.snapshot()).toBe("idle");
});
it("cancels late generation on selection change or close without playing it", async () => {
  let resolve!: (blob: Blob) => void;
  const pending = player.toggle(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  player.dispose();
  resolve(new Blob(["late"]));
  await pending;
  expect(audio.play).not.toHaveBeenCalled();
  expect(player.snapshot()).toBe("idle");
});
it("ignores an old rejection after cancellation and a new request", async () => {
  let reject!: (error: Error) => void;
  const pending = player.toggle(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  player.stop();
  await player.toggle(load);
  reject(new Error("old request"));
  await pending;
  expect(player.snapshot()).toBe("playing");
});
it("reports autoplay rejection and permits explicit retry", async () => {
  const error = new Error("Gesture required");
  error.name = "NotAllowedError";
  audio.play.mockRejectedValueOnce(error);
  const loader = vi.fn(load);
  await player.toggle(loader);
  expect(player.snapshot()).toBe("error");
  await player.toggle(loader);
  expect(player.snapshot()).toBe("playing");
  expect(loader).toHaveBeenCalledTimes(1);
});
it("releases object URLs and pauses playback on close", async () => {
  await player.toggle(load);
  player.dispose();
  expect(audio.pause).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:speech");
});
