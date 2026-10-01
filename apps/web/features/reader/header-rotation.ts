export const HEADER_ROTATION_MS = 5 * 60 * 1000;
export const HEADER_FADE_MS = 250;

export function startHeaderRotation(
  notify: (state: { chapter: boolean; fading: boolean }) => void,
) {
  let chapter = false;
  let fading = false;
  let remaining = HEADER_ROTATION_MS;
  let started = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function schedule() {
    if (document.hidden) return;
    started = performance.now();
    timer = setTimeout(advance, remaining);
  }

  function advance() {
    timer = undefined;
    if (!fading && !motion.matches) {
      fading = true;
      remaining = HEADER_FADE_MS;
    } else {
      chapter = !chapter;
      fading = false;
      remaining = HEADER_ROTATION_MS - (motion.matches ? 0 : HEADER_FADE_MS);
    }
    notify({ chapter, fading });
    schedule();
  }

  function visibilityChanged() {
    if (document.hidden && timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
      remaining = Math.max(0, remaining - (performance.now() - started));
    } else if (!document.hidden && timer === undefined) {
      schedule();
    }
  }

  schedule();
  document.addEventListener("visibilitychange", visibilityChanged);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", visibilityChanged);
  };
}
