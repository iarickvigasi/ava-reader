import { vi } from "vitest";
import type { ReaderLocator } from "@/lib/api-types";
import { createJumpSession } from "../jump-session";
import { emptyJumpHistory } from "../jump-history";
import { createRestoreIntent } from "../navigation";
import { a } from "../jump-session-test-fixture";
import type { QaAck, QaCommand } from "./protocol";
import { createNavigationQa } from "./create-navigation-qa";
export const scope = {
  accountId: "private-account",
  libraryItemId: "book",
  finalContentId: "fixed-content",
  readerFingerprint: "build",
};
export function qaFixture() {
  const view = {
    origin: a as ReaderLocator | null,
    state: emptyJumpHistory(),
    error: null as string | null,
  };
  const navigate =
    vi.fn<(point: ReaderLocator, sequence: number) => void | Promise<void>>();
  const qa = createNavigationQa();
  const session = createJumpSession(
    qa.wrap({
      scope,
      origin: () => view.origin,
      navigate,
      resolve: (target) => target,
      focus: vi.fn(),
      arrive: (target) => {
        view.origin = target;
      },
      leave: () => {
        view.origin = null;
      },
      publish: (state, error) => {
        view.state = state;
        view.error = error;
      },
    }),
  );
  qa.bind(session, scope, ["one", "four"]);
  const acks: QaAck[] = [];
  const disconnect = qa.connect((ack) => acks.push(ack));
  let sequence = 0;
  const command = (
    action: QaCommand["action"],
    extra: Partial<QaCommand> = {},
  ) => {
    const value: QaCommand = {
      type: "command",
      commandId: `operator-${++sequence}`,
      scope: acks[0]!.scope,
      action,
      ...extra,
    };
    qa.receive(value);
    return value;
  };
  const intent = () => {
    const pending = session.inspect().state.pending!;
    return createRestoreIntent(
      pending.destination.chapterId,
      { ...pending.destination, requestId: pending.sequence },
      `test-${pending.sequence}`,
    );
  };
  return { qa, session, view, navigate, acks, command, intent, disconnect };
}
