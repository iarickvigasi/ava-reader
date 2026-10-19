import { useCallback, useEffect, useRef } from "react";

export function useChapterRequest() {
  const active = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const start = useCallback(() => {
    cancel();
    const controller = new AbortController();
    active.current = controller;
    return {
      signal: controller.signal,
      current: () =>
        active.current === controller && !controller.signal.aborted,
    };
  }, [cancel]);
  return { start, cancel };
}
