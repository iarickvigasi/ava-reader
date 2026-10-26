import { useEffect, useState } from "react";

const COVER_FADE_MS = 300;

export function useReaderCoverPresence(visible: boolean) {
  const [exited, setExited] = useState(false);
  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setExited(true), COVER_FADE_MS);
    return () => clearTimeout(timer);
  }, [visible]);
  return visible || !exited;
}
