import Dexie from "dexie";
import { DEXIE_VERSION_SCALE, guardIndexedDb } from "./guard-indexed-db";
import { setDatabaseAccess } from "./database-access";

export class GuardedDatabase extends Dexie {
  constructor(name: string, schemaVersion: number) {
    super(name, {
      indexedDB: guardIndexedDb(
        Dexie.dependencies.indexedDB,
        schemaVersion,
        () => setDatabaseAccess(this, "update-required"),
      ),
    });
    this.on("versionchange", (event) => {
      if (
        event.newVersion &&
        Math.floor(event.newVersion / DEXIE_VERSION_SCALE) > schemaVersion
      ) {
        this.close();
        setDatabaseAccess(this, "update-required");
      }
    });
  }
}
