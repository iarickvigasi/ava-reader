// Dexie reserves the last native version digit for internal schema patches.
export const DEXIE_VERSION_SCALE = 10;

// Dexie 4 retries VersionError without a version and may then patch the schema.
// Intercept success before Dexie's handlers so incompatible stores stay untouched.
export function guardIndexedDb(
  factory: IDBFactory | undefined,
  schemaVersion: number,
  refuse: () => void,
): IDBFactory | undefined {
  if (!factory) return factory;
  return new Proxy(factory, {
    get(target, key) {
      if (key !== "open") {
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (name: string, version?: number) => {
        const request = target.open(name, version);
        request.addEventListener("success", (event) => {
          if (
            Math.floor(request.result.version / DEXIE_VERSION_SCALE) <=
            schemaVersion
          )
            return;
          request.result.close();
          event.stopImmediatePropagation();
          refuse();
          // Deliver a failure to Dexie's existing request error handler. The native
          // request.error is read-only, so provide the error on this event's target.
          request.onerror?.call(request, {
            target: {
              error: new Error("Database requires a newer app version"),
            },
            preventDefault() {},
            stopPropagation() {},
          } as unknown as Event);
        });
        return request;
      };
    },
  });
}
