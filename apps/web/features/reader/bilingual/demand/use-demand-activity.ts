import { useCallback, useState } from "react";

type Activity = { key: string; ids: string[]; signal: AbortSignal };

export function useDemandActivity(key: string, enabled: boolean) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const track = useCallback(
    async (current: Activity, request: () => Promise<void>) => {
      setActivity(current);
      try {
        await request();
      } finally {
        setActivity((previous) => (previous === current ? null : previous));
      }
    },
    [],
  );
  return {
    track,
    activeIds:
      enabled && activity?.key === key && !activity.signal.aborted
        ? activity.ids
        : [],
  };
}
