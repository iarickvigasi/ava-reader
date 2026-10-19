import type { JumpHistory } from "./jump-history";
import type { JumpSessionEffects } from "./jump-session-types";
export type JumpSessionContext = {
  state: JumpHistory;
  error: string | null;
  active: boolean;
  effects: JumpSessionEffects;
};
