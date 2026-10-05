import { expect, it } from "vitest";
import { normalizeUserRoles } from "./normalize-user-roles";

it.each([
  [{ role: "USER" }, []],
  [{ role: "ADMIN" }, ["ADMIN"]],
  [{ role: "DEVELOPER" }, ["DEVELOPER"]],
  [
    { roles: ["DEVELOPER", "ADMIN", "ADMIN", "unknown"] },
    ["ADMIN", "DEVELOPER"],
  ],
  [{ roles: [], role: "ADMIN" }, []],
  [{ roles: ["DEVELOPER"], role: "ADMIN" }, ["DEVELOPER"]],
  [{ role: "unexpected" }, []],
])(
  "normalizes cached roles without resurrecting revoked memberships",
  (user, roles) => {
    const normalized = normalizeUserRoles(user);
    expect(normalized.roles).toEqual(roles);
    expect(normalized).not.toHaveProperty("role");
  },
);
