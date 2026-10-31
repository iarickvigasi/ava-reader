import { afterEach, expect, it, vi } from "vitest";
import { SelectionPlayer } from "./selection-player";
import { FakeAudio } from "./selection-player-test-audio";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("translation cancels late original generation and switching back stops its audio", async () => {
  const clips: FakeAudio[] = [];
  vi.stubGlobal(
    "Audio",
    class extends FakeAudio {
      constructor() {
        super();
        clips.push(this);
      }
    },
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:speech");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const original = new SelectionPlayer();
  const translated = new SelectionPlayer();
  let finish!: (blob: Blob) => void;
  const pending = original.toggle(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const load = () =>
    Promise.resolve(new Blob(["audio"], { type: "audio/mpeg" }));
  await translated.toggle(load);
  finish(new Blob(["late"]));
  await pending;
  expect(clips).toHaveLength(1);
  expect(original.snapshot()).toBe("idle");
  expect(translated.snapshot()).toBe("playing");
  await original.toggle(load);
  expect(clips[0].pause).toHaveBeenCalledOnce();
  expect(translated.snapshot()).toBe("idle");
  expect(original.snapshot()).toBe("playing");
  original.dispose();
  translated.dispose();
});
