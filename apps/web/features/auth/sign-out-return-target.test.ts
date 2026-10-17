import { expect, it } from "vitest";
import { signOutReturnTarget } from "./sign-out-return-target";

const report =
  "/app/admin/pdf-reports?kind=conversionId&reference=pdf-authored&view=export&eventCursor=events-56&costCursor=cost-4";

it.each([
  `https://ava.invalid${report}`,
  `https://ava.invalid${report}&__clerk_handshake=transport-value`,
  `https://ava.invalid${report}&__clerk_handshake_nonce=transport-value&__clerk_db_jwt=private-value`,
])("keeps the report and both cursors without forwarding handshake values (%#)", (url) => {
  const destination = new URL(signOutReturnTarget(url), "https://ava.invalid");
  expect(destination.pathname).toBe("/sign-in");
  expect(destination.searchParams.get("redirect_url")).toBe(report);
  expect([...destination.searchParams.keys()]).toEqual(["redirect_url"]);
});

it.each([
  "https://ava.invalid/app",
  "https://ava.invalid/app/read/book",
  `https://ava.invalid${report}&unknown=private`,
  `https://ava.invalid${report}&reference=other`,
  `https://ava.invalid${report}&__clerk_handshake=x&__clerk_handshake=y`,
  `https://ava.invalid${report}&__clerk_handshake=x&unknown=private`,
  `https://ava.invalid${report.replace("pdf-authored", "sk-private")}&__clerk_handshake=x`,
  `https://ava.invalid${report.replace("cost-4", "Bearer-private")}&__clerk_handshake=x`,
  `https://ava.invalid${report}#private`,
  `https://user:private@ava.invalid${report}&__clerk_handshake=x`,
  "javascript:private",
  "invalid",
])("keeps malformed or other destinations at ordinary sign-in (%#)", (url) => {
  expect(signOutReturnTarget(url)).toBe("/sign-in");
});
