import { HANDLE_GRAB_RADIUS_PX } from "../capture/timing";
import { isWithin, type SelectionEndpoints } from "./range-endpoints";

// Short selections can put both handles inside the same touch target. Honor
// the nearer endpoint instead of always grabbing the end of the range.
export function selectionHandleAt(
  endpoints: SelectionEndpoints,
  x: number,
  y: number,
): "start" | "end" | null {
  const start = isWithin(endpoints.start, x, y, HANDLE_GRAB_RADIUS_PX);
  const end = isWithin(endpoints.end, x, y, HANDLE_GRAB_RADIUS_PX);
  if (!start && !end) return null;
  if (!start) return "end";
  if (!end) return "start";

  const startDistance = Math.hypot(endpoints.start.x - x, endpoints.start.y - y);
  const endDistance = Math.hypot(endpoints.end.x - x, endpoints.end.y - y);
  return startDistance <= endDistance ? "start" : "end";
}
