import { useRef } from "react";

/**
 * A ref whose `.current` mirrors the latest `value`, updated DURING render (not
 * in an effect). A `useLayoutEffect` reading this ref sees the current commit's
 * value before paint; an effect-based sync lags by one commit and would make the
 * reader decide against stale inputs (a one-frame wrong-page flash on chapter
 * changes). Keep the value out of the effect's deps and read it through the ref.
 */
export function useRenderSyncedRef<T>(value: T) {
  const ref = useRef(value);
  // eslint-disable-next-line react-hooks/refs
  ref.current = value;
  return ref;
}
