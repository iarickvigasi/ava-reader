import { vi } from "vitest";

export class FakeAudio {
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
