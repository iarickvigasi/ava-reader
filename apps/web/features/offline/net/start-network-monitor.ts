import { isSlow, subscribeToSlowState } from "./slow-state";
import {
  checkNetworkReachability,
  isOnline,
  subscribeToNetworkState,
} from "./net-state";

const ONLINE_INTERVAL_MS = 30_000;
const OFFLINE_INTERVAL_MS = 10_000;

export function startNetworkMonitor() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const schedule = () => {
    clearTimeout(timer);
    if (stopped || document.visibilityState === "hidden") return;
    timer = setTimeout(
      check,
      isOnline() && !isSlow() ? ONLINE_INTERVAL_MS : OFFLINE_INTERVAL_MS,
    );
  };
  const check = () => {
    clearTimeout(timer);
    if (stopped || document.visibilityState === "hidden") return;
    void checkNetworkReachability().finally(schedule);
  };
  const unsubscribe = subscribeToNetworkState(schedule);
  const unsubscribeSlow = subscribeToSlowState(schedule);
  document.addEventListener("visibilitychange", check);
  check();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
    unsubscribeSlow();
    document.removeEventListener("visibilitychange", check);
  };
}
