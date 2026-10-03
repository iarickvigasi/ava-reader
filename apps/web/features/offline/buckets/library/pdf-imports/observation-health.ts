import { getDb, type AvaReaderDB } from "../../../db";

let observedDb: AvaReaderDB | null = null;
let fresh = false;
const listeners = new Set<() => void>();
export function setPdfObservationHealth(db: AvaReaderDB, next: boolean) {
  if (db !== getDb()) return;
  observedDb = db;
  fresh = next;
  for (const listener of listeners) listener();
}
export function pdfObservationIsFresh() {
  return fresh && observedDb === getDb();
}
export function subscribePdfObservationHealth(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
