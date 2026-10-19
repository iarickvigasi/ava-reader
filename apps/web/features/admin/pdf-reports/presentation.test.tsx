import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "operator",
    sessionId: "session",
  }),
}));
vi.mock("./load-report", () => ({
  loadReport: vi.fn(() => {
    throw new Error("Report must not be server-rendered");
  }),
}));
import { loadReport } from "./load-report";
import Page from "@/app/app/admin/pdf-reports/page";
import { ReportCostPanel } from "@/components/app/admin/pdf-reports/cost-panel";
import { ReportStateNotice } from "@/components/app/admin/pdf-reports/state-notice";
import { ReportClient } from "@/components/app/admin/pdf-reports/client";
import { Children, isValidElement } from "react";

it("renders only a loading shell before the authenticated API read, including an old-SW first visit", async () => {
  const html = renderToStaticMarkup(
    await Page({
      searchParams: Promise.resolve({
        kind: "conversionId",
        reference: "report-id",
      }),
    }),
  );
  expect(loadReport).not.toHaveBeenCalled();
  expect(html).toContain("Loading conversion report");
  expect(html).not.toContain("Safe report fields");
  expect(html).not.toContain("Final actual amount verified");
});
it("does not serialize a malformed or secret-like pasted reference into client props", async () => {
  const tree = await Page({
    searchParams: Promise.resolve({
      kind: "conversionId",
      reference: "/private/book.pdf",
    }),
  });
  const client = Children.toArray(tree.props.children).find(
    (child) => isValidElement(child) && child.type === ReportClient,
  );
  expect(isValidElement(client) && client.props).toEqual({
    search: {},
    invalidSearch: true,
  });
});
it("keeps unknown and uncertain money explicit and provides a stale-cost restart without either cursor", () => {
  const cost = renderToStaticMarkup(
    <ReportCostPanel value={{ state: "MISSING" }} />,
  );
  expect(cost).toContain("Unknown");
  expect(cost).not.toContain("$0.");
  const notice = renderToStaticMarkup(
    <ReportStateNotice
      state="changed"
      query={{
        kind: "conversionId",
        reference: "pdf-1",
        view: "cost",
        eventCursor: "events",
        costCursor: "stale",
      }}
    />,
  );
  expect(notice).toContain("Start this view again");
  expect(notice).not.toContain("costCursor");
  expect(notice).not.toContain("eventCursor");
});
