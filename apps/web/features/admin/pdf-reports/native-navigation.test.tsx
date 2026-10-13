import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

// The observed failure updates the address while soft navigation retains the
// prior report. Query-bound controls must use the browser document transition.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => {
    if (href.startsWith("/app/admin/pdf-reports"))
      throw new Error("Report soft navigation retained the previous page");
    return createElement("a", { href }, children);
  },
}));
import { ReportResult } from "@/components/app/admin/pdf-reports/result";
import { ReportLookupResults } from "@/components/app/admin/pdf-reports/lookup-results";
import { ReportStateNotice } from "@/components/app/admin/pdf-reports/state-notice";
import { REPORT_ROUTE, type ReportQuery } from "./query";
import type { ReportData } from "./types";

const query: ReportQuery = {
  kind: "conversionId",
  reference: "pdf-1",
  view: "events",
  eventCursor: "after-4",
  costCursor: "cost-page-1",
};
const report: ReportData = {
  value: { watermark: 44, events: [] },
  omittedFields: 0,
  nextCursor: "after-8",
};
function links(html: string) {
  return [
    ...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
  ].map(([, href, label]) => ({
    label,
    url: new URL(href.replaceAll("&amp;", "&"), "https://ava.invalid"),
  }));
}

it("opens report views and timeline continuation as full documents with the intended cursor", () => {
  const controls = links(
    renderToStaticMarkup(<ReportResult query={query} report={report} />),
  );
  expect(controls).toHaveLength(6);
  expect(controls.every(({ url }) => url.pathname === REPORT_ROUTE)).toBe(true);
  const cost = controls.find(
    ({ url }) => url.searchParams.get("view") === "cost",
  )!;
  expect(cost.url.searchParams.get("reference")).toBe("pdf-1");
  const next = controls.find(({ label }) => label === "Next timeline page")!;
  expect(next.url.searchParams.get("eventCursor")).toBe("after-8");
  expect(next.url.searchParams.get("costCursor")).toBe("cost-page-1");
  const restart = controls.find(
    ({ label }) => label === "Start this view again",
  )!;
  expect(restart.url.searchParams.has("eventCursor")).toBe(false);
});

it("continues costs through their own cursor without changing the timeline cursor", () => {
  const controls = links(
    renderToStaticMarkup(
      <ReportResult
        query={{ ...query, view: "cost" }}
        report={{
          ...report,
          value: { state: "PROVISIONAL" },
          nextCursor: "cost-page-2",
        }}
      />,
    ),
  );
  const next = controls.find(({ label }) => label === "Next cost page")!;
  expect(next.url.searchParams.get("costCursor")).toBe("cost-page-2");
  expect(next.url.searchParams.get("eventCursor")).toBe("after-4");
});

it("opens a lookup match as its own snapshot and restarts stale costs without either cursor", () => {
  const lookup = links(
    renderToStaticMarkup(
      <ReportLookupResults
        report={{
          ...report,
          nextCursor: null,
          value: {
            complete: true,
            results: [
              { conversionId: "pdf-2", status: "FAILED", stage: "EXTRACTION" },
            ],
          },
        }}
      />,
    ),
  );
  expect(lookup).toHaveLength(1);
  expect(Object.fromEntries(lookup[0].url.searchParams)).toEqual({
    kind: "conversionId",
    reference: "pdf-2",
    view: "snapshot",
  });
  const restart = links(
    renderToStaticMarkup(
      <ReportStateNotice state="changed" query={{ ...query, view: "cost" }} />,
    ),
  )[0].url;
  expect(Object.fromEntries(restart.searchParams)).toEqual({
    kind: "conversionId",
    reference: "pdf-1",
    view: "cost",
  });
});

it("preserves exact report reference, view and both cursors through sign-in recovery", () => {
  const signIn = links(
    renderToStaticMarkup(<ReportStateNotice state="signIn" query={query} />),
  ).find(({ label }) => label === "Sign in")!;
  const target = new URL(
    signIn.url.searchParams.get("redirect_url")!,
    "https://ava.invalid",
  );
  expect(target.pathname).toBe(REPORT_ROUTE);
  expect(Object.fromEntries(target.searchParams)).toEqual(query);
});

it("omits credential-shaped cursor values from the sign-in recovery URL", () => {
  const signIn = links(
    renderToStaticMarkup(
      <ReportStateNotice
        state="signIn"
        query={{ ...query, eventCursor: "sk-private" }}
      />,
    ),
  ).find(({ label }) => label === "Sign in")!;
  expect(signIn.url.searchParams.get("redirect_url")).toBe("/app");
  expect(signIn.url.href).not.toContain("sk-private");
});
