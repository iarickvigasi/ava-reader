import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { DatabaseAccess } from "./database-access";
import { DatabaseAccessGate } from "./database-access-gate";

const access = vi.hoisted(() => ({ state: "opening" as DatabaseAccess }));
vi.mock("./use-database-access", () => ({
  useDatabaseAccess: () => access.state,
}));

it.each(["opening", "update-required", "unavailable"] as const)(
  "does not render account consumers while %s",
  (state) => {
    access.state = state;
    const renderAccount = vi.fn(() => <p>Private library</p>);
    const Account = renderAccount;
    const html = renderToStaticMarkup(
      <DatabaseAccessGate>
        <Account />
      </DatabaseAccessGate>,
    );
    expect(renderAccount).not.toHaveBeenCalled();
    if (state === "update-required") {
      expect(html).toContain("Please update AVA Reader");
      expect(html).toContain("offline");
      expect(html).toContain("Reload app");
    }
    if (state === "unavailable") {
      expect(html).toContain("Local storage is unavailable");
      expect(html).not.toContain("Please update AVA Reader");
    }
  },
);

it("renders account consumers only after the database opens", () => {
  access.state = "ready";
  expect(
    renderToStaticMarkup(
      <DatabaseAccessGate>
        <p>Private library</p>
      </DatabaseAccessGate>,
    ),
  ).toContain("Private library");
});
