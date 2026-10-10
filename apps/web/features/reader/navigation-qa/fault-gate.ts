import type { ReaderLocator } from "@/lib/api-types";
import { sameReaderPlace } from "../jump-target";
import type { QaCommand } from "./protocol";
type Work = () => void | Promise<void>;
type Held = {
  command: QaCommand;
  stage: QaCommand["stage"];
  sequence: number;
  target: ReaderLocator;
  current: () => boolean;
  work: Work;
  done: () => void;
  fail: (error: unknown) => void;
  promise: Promise<void>;
};
export function createFaultGate(
  emit: (phase: string, command: QaCommand, sequence?: number) => void,
) {
  let armed: QaCommand | null = null;
  let held: Held | null = null;
  const release = () => {
    const item = held;
    held = null;
    if (!item) return;
    emit(
      item.current() ? "released" : "released-stale",
      item.command,
      item.sequence,
    );
    if (item.current())
      void Promise.resolve()
        .then(() => {
          if (item.current()) return item.work();
        })
        .then(item.done, item.fail);
    else item.done();
  };
  return {
    arm: (command: QaCommand) => {
      if (held) return false;
      armed = command;
      return true;
    },
    release,
    clear: () => {
      armed = null;
      release();
    },
    run: (
      stage: QaCommand["stage"],
      target: ReaderLocator,
      sequence: number,
      current: () => boolean,
      work: Work,
    ) => {
      if (held?.sequence === sequence && held.stage === stage) {
        held.work = work;
        return held.promise;
      }
      const command = armed;
      if (
        !command ||
        command.stage !== stage ||
        !sameReaderPlace(command.target ?? null, target)
      )
        return Promise.resolve().then(() => {
          if (current()) return work();
        });
      armed = null;
      if (command.action === "arm-fail") {
        emit("fault", command, sequence);
        return Promise.reject(new Error("QA injected navigation failure"));
      }
      emit("held", command, sequence);
      let done = () => {};
      let fail: (error: unknown) => void = () => {};
      const promise = new Promise<void>((resolve, reject) => {
        done = resolve;
        fail = reject;
      });
      held = {
        command,
        stage,
        sequence,
        target,
        current,
        work,
        done,
        fail,
        promise,
      };
      return promise;
    },
  };
}
