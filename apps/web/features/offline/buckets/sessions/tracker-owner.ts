import { getDb } from "../../db";
import { claimSession } from "./claim-session";
import { checkpointSession } from "./checkpoint-session";
import { generateClientSessionId } from "./id";
import { acquireSessionOwnership } from "./session-ownership";
import type { ReadingClock, ReadingMoment, ReadingTick } from "./types";

export function createTrackerOwner(libraryItemId: string, clock: ReadingClock) {
  const db = getDb();
  const ownerId = generateClientSessionId();
  let active: string | null = null;
  let ownership: Awaited<ReturnType<typeof acquireSessionOwnership>> = null;
  let acquisition: AbortController | null = null;

  function release() {
    ownership?.release();
    ownership = null;
    active = null;
  }

  async function record(stop: boolean, tick: ReadingTick) {
    if (db !== getDb()) {
      release();
      return null;
    }
    if (active) {
      const stillOpen = await checkpointSession(db, {
        ownerId,
        clientSessionId: active,
        tick,
        stop,
      });
      if (!stillOpen) active = null;
    }
    const started = !stop && !active ? await claimNextSession() : null;
    if (!active || stop) release();
    return started;
  }

  async function claimNextSession(): Promise<ReadingMoment | null> {
    acquisition = new AbortController();
    ownership ??= await acquireSessionOwnership(db.name, acquisition.signal);
    let started: ReadingMoment | null = null;
    if (ownership && !acquisition.signal.aborted) {
      const at = {
        wallNow: clock.wallNow(),
        monotonicNow: clock.monotonicNow(),
      };
      active = await claimSession(db, {
        ownerId,
        libraryItemId,
        now: at.wallNow,
        exclusive: ownership.exclusive,
      });
      if (active) started = at;
    }
    acquisition = null;
    return started;
  }

  return { record, release, cancelPending: () => acquisition?.abort() };
}
