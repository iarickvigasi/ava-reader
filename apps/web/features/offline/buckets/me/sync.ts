import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb, type AvaReaderDB } from "../../db";
import { isOnline } from "../../net/net-state";
import { withDeadline } from "@/features/auth/with-deadline";
import { cancelRetry, scheduleRetry } from "../shared/bucket-core";
import { revalidateHome } from "../home/revalidate";
import { applyCurrentUser } from "./storage";
import { readProfileMutation, settleProfileMutation } from "./profile-storage";

type GetToken = () => Promise<string | null>;
const runs = new WeakMap<AvaReaderDB, Promise<void>>();
const retries = new WeakMap<
  AvaReaderDB,
  { retryHandle: ReturnType<typeof setTimeout> | null; retryDelayMs: number }
>();

export function flushProfile(getToken: GetToken): Promise<void> {
  const db = getDb();
  const running = runs.get(db);
  if (running) return running;
  const retry = retries.get(db) ?? { retryHandle: null, retryDelayMs: 0 };
  retries.set(db, retry);
  cancelRetry(retry);
  const run = async () => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      await navigator.locks.request(`ava:profile:${db.name}`, () =>
        drain(db, getToken),
      );
    } else await drain(db, getToken);
    retry.retryDelayMs = 0;
  };
  const promise = run()
    .catch(() => {
      if (db === getDb())
        scheduleRetry(retry, () => {
          if (db === getDb()) void flushProfile(getToken);
        });
    })
    .finally(() => {
      runs.delete(db);
      if (!retry.retryHandle && db === getDb() && isOnline()) {
        void readProfileMutation(db)
          .then((pending) => {
            if (
              pending &&
              !pending.error &&
              !retry.retryHandle &&
              db === getDb()
            )
              void flushProfile(getToken);
          })
          .catch(() => undefined);
      }
    });
  runs.set(db, promise);
  return promise;
}

async function drain(db: AvaReaderDB, getToken: GetToken) {
  while (db === getDb() && isOnline()) {
    const pending = await readProfileMutation(db);
    if (!pending || pending.error) return;
    const token = await withDeadline(getToken());
    if (db !== getDb()) return;
    if (!token) throw new Error("Authentication unavailable");
    const response = await fetch(`${getPublicApiBaseUrl()}/api/me/profile`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pending.patch),
      signal: AbortSignal.timeout(15_000),
    });
    if (db !== getDb()) return;
    if ([400, 403, 404, 422].includes(response.status)) {
      await settleProfileMutation(db, pending.revision, true);
      continue;
    }
    if (!response.ok) throw new Error("Profile sync unavailable");
    const user = await withDeadline(response.json());
    if (db !== getDb()) return;
    await applyCurrentUser(user);
    await settleProfileMutation(db, pending.revision);
    void revalidateHome(getToken).catch(() => undefined);
  }
}
