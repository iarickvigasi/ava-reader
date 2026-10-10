import { useCallback, useMemo, useState } from "react";

export function useReaderCoverTransition() {
  const [opening, setOpening] = useState(true);
  const reportLoading = useCallback((loading: boolean) => {
    setOpening((current) => current && loading);
  }, []);
  return useMemo(() => ({ opening, reportLoading }), [opening, reportLoading]);
}
