import { expect, it } from "vitest";
import { parseReportQuery, reportApiPath, reportHref } from "./query";

it("builds only finite GET report routes with independent cursor namespaces", () => {
  const query = parseReportQuery({
    kind: "conversionId",
    reference: "pdf-123",
    view: "cost",
    eventCursor: "timeline",
    costCursor: "billing",
  })!;
  expect(reportApiPath(query)).toBe(
    "/api/admin/pdf-conversion-reports/pdf-123/cost?limit=25&cursor=billing",
  );
  expect(reportApiPath({ ...query, view: "events" })).toContain(
    "cursor=timeline",
  );
  expect(reportApiPath({ ...query, view: "export" })).toContain(
    "cursor=timeline",
  );
  expect(reportHref({ ...query, costCursor: undefined })).not.toContain(
    "costCursor",
  );
  expect(
    reportApiPath(
      parseReportQuery({ kind: "failureId", reference: "failure:1" })!,
    ),
  ).toContain("lookup?failureId=failure%3A1");
});
it("refuses path traversal, secret-like references, duplicate or unrelated query values", () => {
  for (const reference of [
    ".",
    "..",
    "../private",
    "https:secret",
    "sk-private",
    "Bearer-key",
    "x?view=cost",
  ]) {
    expect(() =>
      parseReportQuery({ kind: "conversionId", reference }),
    ).toThrow();
  }
  for (const extra of [
    { method: "POST" },
    { limit: "100" },
    { reference: ["one", "two"] },
    { kind: "file" },
    { view: "retry" },
    { costCursor: "a/b" },
  ]) {
    expect(() =>
      parseReportQuery({ kind: "conversionId", reference: "id", ...extra }),
    ).toThrow();
  }
  expect(() =>
    parseReportQuery({ kind: "bookId", reference: "id", eventCursor: "abc" }),
  ).toThrow();
  expect(parseReportQuery({})).toBeNull();
});
