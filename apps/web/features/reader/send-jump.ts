import type { JumpRequest } from "./jump-history";
import type { JumpSessionEffects } from "./jump-session-types";
export function sendJump(
  request: JumpRequest,
  current: () => boolean,
  effects: () => JumpSessionEffects,
  fail: () => void,
) {
  void Promise.resolve()
    .then(() => {
      if (current())
        return effects().navigate(request.destination, request.sequence);
    })
    .catch(() => {
      if (current()) fail();
    });
}
