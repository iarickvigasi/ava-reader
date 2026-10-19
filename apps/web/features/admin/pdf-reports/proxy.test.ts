import { expect, it, vi } from "vitest";
vi.mock("./load-report", () => ({ loadReport: vi.fn() }));
import { loadReport } from "./load-report";
import { GET } from "@/app/api/admin/pdf-reports/route";

it("keeps duplicate parameters for strict validation and marks every response private/no-store", async () => {
  vi.mocked(loadReport).mockResolvedValue({ state: "invalid" });
  const response = await GET(
    new Request(
      "https://ava.invalid/api/admin/pdf-reports?reference=one&reference=two&__proto__=x",
    ),
  );
  const search = vi.mocked(loadReport).mock.calls.at(-1)![0];
  expect(search.reference).toEqual(["one", "two"]);
  expect(Object.hasOwn(search, "__proto__")).toBe(true);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(await response.json()).toEqual({ state: "invalid" });
});
it("keeps normal sign-in and ADMIN denial explicit without exporting private bodies", async () => {
  for (const [state, status] of [
    ["signIn", 401],
    ["forbidden", 403],
  ] as const) {
    vi.mocked(loadReport).mockResolvedValue({ state });
    const response = await GET(
      new Request("https://ava.invalid/api/admin/pdf-reports"),
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ state });
  }
});
