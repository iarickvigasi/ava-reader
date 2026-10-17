import type { ReaderLocator } from "@/lib/api-types";
import type { JumpHistory } from "../jump-history";
import type { JumpSessionEffects } from "../jump-session-types";
import type { createJumpSession } from "../jump-session";
import type { NavigationScope } from "../navigation-scope";
export const READER_QA_CHANNEL = "ava-reader-qa";
export type QaScope = Omit<NavigationScope, "accountId"> & {
  accountScope?: string;
};
export type QaCommand = {
  type: "command";
  commandId: string;
  scope: QaScope;
  action:
    | "snapshot"
    | "arm-fail"
    | "arm-hold"
    | "release"
    | "cancel"
    | "inject-stale";
  stage?: "navigate" | "restore";
  target?: ReaderLocator;
  entryScope?: QaScope;
};
export type QaAck = {
  type: "ack";
  commandId: string;
  ok: boolean;
  phase: string;
  reason?: string;
  scope: QaScope;
  sequence: number;
  pending: JumpHistory["pending"];
  origin: ReaderLocator | null;
  history: ReaderLocator[];
  historyScopes: (QaScope | null)[];
  loadedChapterIds: string[];
  stage?: QaCommand["stage"];
  actualRestoreSuccess?: boolean;
  target?: ReaderLocator;
};
export type QaSession = ReturnType<typeof createJumpSession>;
export type QaView = {
  session: QaSession | null;
  scope: NavigationScope | null;
  accountScope: string;
  loadedChapterIds: string[];
};
export type NavigationQa = {
  bind: (
    session: QaSession,
    scope: NavigationScope,
    chapterIds: string[],
  ) => void;
  wrap: (effects: JumpSessionEffects) => JumpSessionEffects;
  settle: QaSession["settle"];
  receive: (value: unknown) => void;
  connect: (send: (ack: QaAck) => void) => () => void;
};
