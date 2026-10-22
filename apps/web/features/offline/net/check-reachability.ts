import { probeReachability } from "./probe-reachability";
import { setProbeDegraded } from "./slow-state";

const SLOW_MS = 3_000;
const DEADLINE_MS = 5_000;

export async function checkReachability(
  controller: AbortController,
  isCurrent: () => boolean,
): Promise<boolean | null> {
  let slow = false;
  const slowTimer = setTimeout(() => {
    slow = true;
    if (isCurrent()) setProbeDegraded(true);
  }, SLOW_MS);
  const deadline = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const reachable = await probeReachability(controller.signal);
    if (isCurrent() && reachable !== null) setProbeDegraded(!reachable || slow);
    return reachable;
  } catch {
    if (isCurrent()) setProbeDegraded(true);
    return false;
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(deadline);
  }
}
