export type DatabaseAccess =
  | "opening"
  | "ready"
  | "update-required"
  | "unavailable";
type Entry = { state: DatabaseAccess; listeners: Set<() => void> };
const entries = new WeakMap<object, Entry>();

export function databaseAccess(db: object): Entry {
  let entry = entries.get(db);
  if (!entry) {
    entry = { state: "opening", listeners: new Set() };
    entries.set(db, entry);
  }
  return entry;
}

export function setDatabaseAccess(db: object, state: DatabaseAccess) {
  const entry = databaseAccess(db);
  if (entry.state === state) return;
  entry.state = state;
  entry.listeners.forEach((listener) => listener());
}

export async function openAccountDatabase(db: {
  open(): PromiseLike<unknown>;
}) {
  try {
    await db.open();
    if (databaseAccess(db).state !== "update-required")
      setDatabaseAccess(db, "ready");
  } catch {
    if (databaseAccess(db).state !== "update-required")
      setDatabaseAccess(db, "unavailable");
  }
}
