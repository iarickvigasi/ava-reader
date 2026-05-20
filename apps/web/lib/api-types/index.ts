// Barrel re-export of API payload types, grouped by domain.
//
// Prefer importing from a domain file directly (e.g. `@/lib/api-types/reader`)
// in new code so the dependency graph stays explicit. This barrel exists so
// the long-standing `@/lib/api-types` import path keeps working.

export * from "./admin";
export * from "./home";
export * from "./library";
export * from "./reader";
export * from "./shared";
export * from "./user";
