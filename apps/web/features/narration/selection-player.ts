import { narrationErrorState } from "./narration-error-state";
export type NarrationState =
  | "idle"
  | "loading"
  | "playing"
  | "error"
  | "uncertain"
  | "ready"
  | "auth"
  | "provider"
  | "timeout";

export class SelectionPlayer {
  private state: NarrationState = "idle";
  private listeners = new Set<() => void>();
  private request: AbortController | null = null;
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;

  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  stop = () => {
    this.request?.abort();
    this.request = null;
    this.audio?.pause();
    if (this.audio) this.audio.currentTime = 0;
    this.update("idle");
  };

  dispose = () => {
    this.stop();
    if (this.audio) {
      this.audio.onplaying = this.audio.onwaiting = this.audio.onended = null;
      this.audio.onerror = this.audio.onpause = null;
      this.audio.removeAttribute("src");
      this.audio.load();
    }
    this.audio = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  };

  async toggle(load: (signal: AbortSignal) => Promise<Blob>) {
    if (this.state === "loading" || this.state === "playing")
      return this.stop();
    const request = new AbortController();
    this.request = request;
    this.update("loading");
    try {
      if (!this.audio) {
        const blob = await load(request.signal);
        if (request.signal.aborted) return;
        this.url = URL.createObjectURL(blob);
        this.audio = new Audio(this.url);
        this.bindEvents(this.audio);
      }
      await this.audio.play();
    } catch (error) {
      if (!request.signal.aborted) {
        // Keep generated audio for a direct user-gesture retry on Safari.
        if (!(error instanceof Error && error.name === "NotAllowedError"))
          this.dispose();
        this.update(narrationErrorState(error));
      }
    }
  }

  private bindEvents(audio: HTMLAudioElement) {
    audio.onplaying = () => this.update("playing");
    audio.onwaiting = () => this.update("loading");
    audio.onended = this.stop;
    audio.onpause = () => this.update("idle");
    audio.onerror = () => {
      this.dispose();
      this.update("error");
    };
  }

  private update(state: NarrationState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}
