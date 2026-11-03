import { measureReadingTick } from "./measure-reading-tick";
import { createTrackerOwner } from "./tracker-owner";
import type { ReadingClock, ReadingMoment } from "./types";

// Only local I/O is serialized. Network/auth changes never recreate this owner.
export function createReadingTracker(
  libraryItemId: string,
  clock: ReadingClock = {
    wallNow: Date.now,
    monotonicNow: () => performance.now(),
  },
) {
  const owner = createTrackerOwner(libraryItemId, clock);
  let pending = Promise.resolve();
  let lastMoment = {
    wallNow: clock.wallNow(),
    monotonicNow: clock.monotonicNow(),
  };
  let generation = 0;

  function record(stop: boolean) {
    if (stop) {
      generation++;
      owner.cancelPending();
    }
    const requestedGeneration = generation;
    const moment = {
      wallNow: clock.wallNow(),
      monotonicNow: clock.monotonicNow(),
    };
    pending = pending
      .then(() => persist(stop, requestedGeneration, moment))
      .catch(() => {
        // Retry from the previous durable moment on the next checkpoint.
        if (stop) owner.release();
      });
    return pending;
  }

  async function persist(
    stop: boolean,
    requestedGeneration: number,
    moment: ReadingMoment,
  ) {
    const stale =
      requestedGeneration !== generation ||
      moment.monotonicNow < lastMoment.monotonicNow;
    if (!stop && stale) return;
    const tick = measureReadingTick(lastMoment, moment);
    const started = await owner.record(stop, tick);
    lastMoment = started ?? moment;
  }

  return {
    start: () => record(false),
    checkpoint: () => record(false),
    stop: () => record(true),
  };
}
