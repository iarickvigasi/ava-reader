import { expect, it } from "vitest";
import { SelectionPlayer } from "./selection-player";
it("announces language uncertainty without attempting audio playback", async () => {
  const player = new SelectionPlayer();
  const error = new Error("Select more context");
  error.name = "NarrationLanguageUncertainError";
  await player.toggle(async () => {
    throw error;
  });
  expect(player.snapshot()).toBe("uncertain");
  player.stop();
  expect(player.snapshot()).toBe("idle");
});
