import { useEffect, useState } from "react";

const COVER_MINIMUM_VISIBLE_MS = 1_000;

export function useReaderCoverHold(available: boolean) {
  const [holding, setHolding] = useState(true);
  useEffect(() => {
    if (!available) return;
    const timer = setTimeout(() => setHolding(false), COVER_MINIMUM_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [available]);
  return holding;
}
