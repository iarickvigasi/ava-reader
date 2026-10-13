import { expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
const authenticate = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: () => authenticate,
}));
import proxy from "./proxy";
import PdfReportsPage from "./app/app/admin/pdf-reports/page";
import { ReportClient } from "./components/app/admin/pdf-reports/client";
import { Children, isValidElement } from "react";
const event = {} as NextFetchEvent;
it("serves app shells when Clerk attempts a handshake redirect", async () => {
  authenticate.mockResolvedValue(
    Response.redirect("https://clerk.example.com/handshake"),
  );
  const response = await proxy(
    new NextRequest("https://example.com/app/read/book"),
    event,
  );
  expect(response?.status).toBe(200);
  expect(response?.headers.get("location")).toBeNull();
});
it("serves app shells during provider failure", async () => {
  authenticate.mockRejectedValue(new Error("unreachable"));
  expect(
    (await proxy(new NextRequest("https://example.com/app"), event))?.status,
  ).toBe(200);
});
it("preserves auth redirects outside app shells", async () => {
  authenticate.mockResolvedValue(
    Response.redirect("https://clerk.example.com/handshake"),
  );
  expect(
    (await proxy(new NextRequest("https://example.com/sign-in"), event))
      ?.status,
  ).toBe(302);
});

const report =
  "/app/admin/pdf-reports?kind=conversionId&reference=pdf-authored&view=export&eventCursor=events-56&costCursor=cost-4";

it.each(["__clerk_handshake", "__clerk_handshake_nonce"])(
  "preserves the SDK's %s cleanup response and exact report context",
  async (transport) => {
    const cleanup = new Response(null, {
      status: 307,
      headers: {
        location: `https://example.com${report}`,
        "set-cookie": "authored-session=private-cookie-canary; HttpOnly",
        "cache-control": "no-store",
      },
    });
    authenticate.mockResolvedValue(cleanup);
    const response = await proxy(
      new NextRequest(
        `https://example.com${report}&${transport}=private-handshake-canary&__clerk_help=1&__clerk_db_jwt=private-browser-canary`,
      ),
      event,
    );
    expect(response).toBe(cleanup);
    expect(response?.headers.get("set-cookie")).toBe(
      cleanup.headers.get("set-cookie"),
    );
    const url = new URL(response!.headers.get("location")!);
    const tree = await PdfReportsPage({
      searchParams: Promise.resolve(Object.fromEntries(url.searchParams)),
    });
    const client = Children.toArray(tree.props.children).find(
      (child) => isValidElement(child) && child.type === ReportClient,
    );
    expect(isValidElement(client) && client.props).toEqual({
      search: {
        kind: "conversionId",
        reference: "pdf-authored",
        view: "export",
        eventCursor: "events-56",
        costCursor: "cost-4",
      },
      invalidSearch: false,
    });
    expect(
      JSON.stringify(isValidElement(client) && client.props),
    ).not.toContain("private-");
  },
);

it("compares validated report context rather than raw query order/default spelling", async () => {
  const cleanup = Response.redirect(
    "https://example.com/app/admin/pdf-reports?kind=conversionId&reference=pdf-authored&view=snapshot",
  );
  authenticate.mockResolvedValue(cleanup);
  expect(
    await proxy(
      new NextRequest(
        "https://example.com/app/admin/pdf-reports?reference=pdf-authored&kind=conversionId&__clerk_handshake=authored",
      ),
      event,
    ),
  ).toBe(cleanup);
});

it.each([
  [report, report],
  [`${report}&__clerk_handshake=one&__clerk_handshake=two`, report],
  [
    `${report}&__clerk_handshake=one&__clerk_handshake_nonce=one&__clerk_handshake_nonce=two`,
    report,
  ],
  [`${report}&__clerk_handshake=one&__clerk_help=1&__clerk_help=2`, report],
  [`${report}&__clerk_handshake=`, report],
  [`${report}&__clerk_handshake=one&unexpected=sk-private`, report],
  [`${report}&__clerk_handshake=one&__clerk_ticket=sk-private`, report],
  [`${report}&__clerk_handshake=one&reference=other`, report],
  [
    `${report.replace("events-56", "sk-private")}&__clerk_handshake=one`,
    report,
  ],
  [
    `${report.replace("cost-4", "Bearer-private")}&__clerk_handshake=one`,
    report,
  ],
  [`${report}&__clerk_handshake=one`, `${report}&__clerk_handshake=one`],
  [`${report}&__clerk_handshake=one`, `${report}&unexpected=one`],
  [`${report}&__clerk_handshake=one`, `${report}&reference=other`],
  [`${report}&__clerk_handshake=one`, report.replace("pdf-authored", "other")],
  [
    "/app/admin/pdf-reports?kind=conversionId&reference=pdf-authored&view=snapshot&__clerk_handshake=one",
    "/app/admin/pdf-reports?kind=operationId&reference=pdf-authored&view=snapshot",
  ],
  [
    `${report}&__clerk_handshake=one`,
    report.replace("view=export", "view=cost"),
  ],
  [`${report}&__clerk_handshake=one`, report.replace("events-56", "events-60")],
  [`${report}&__clerk_handshake=one`, report.replace("cost-4", "cost-8")],
  [`${report}&__clerk_handshake=one`, `${report}#private`],
  [`${report}&__clerk_handshake=one`, "/app"],
  [`${report}&__clerk_handshake=one`, "/sign-in"],
  [`${report}&__clerk_handshake=one`, `https://foreign.example${report}`],
  [
    `${report}&__clerk_handshake=one`,
    `https://authored:private@example.com${report}`,
  ],
  [`${report}&__clerk_handshake=one`, `http://example.com${report}`],
  ["/app/read/book?__clerk_handshake=one", "/app/read/book"],
])("keeps non-cleanup app redirects suppressed (%#)", async (input, target) => {
  authenticate.mockResolvedValue(
    Response.redirect(new URL(target, "https://example.com")),
  );
  const response = await proxy(
    new NextRequest(`https://example.com${input}`),
    event,
  );
  expect(response?.status).toBe(200);
  expect(response?.headers.get("location")).toBeNull();
});
