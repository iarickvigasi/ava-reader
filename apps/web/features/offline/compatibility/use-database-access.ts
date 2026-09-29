"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getDb } from "../db";
import { databaseAccess, openAccountDatabase } from "./database-access";

export function useDatabaseAccess() {
  const db = getDb();
  const state = useSyncExternalStore(
    (listener) => {
      const entry = databaseAccess(db);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    () => databaseAccess(db).state,
    () => "opening" as const,
  );
  useEffect(() => {
    void openAccountDatabase(db);
  }, [db]);
  return state;
}
