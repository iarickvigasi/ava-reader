import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ComponentProps, type ReactNode } from "react";
import {
  authHooks,
  resetAuthHooks,
} from "@/components/auth/auth-readiness-test-hooks";
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  ...(await import("@/components/auth/auth-readiness-test-hooks"))
    .authMockHooks,
}));
import { ReportSearchForm } from "@/components/app/admin/pdf-reports/search-form";
import { TextInput } from "@/components/ui/text-input";
import { REPORT_ROUTE, referenceKinds, type ReportQuery } from "./query";

const query: ReportQuery = {
  kind: "operationId",
  reference: "operation-1",
  view: "snapshot",
};
function find<T>(node: ReactNode, type: unknown): T | undefined {
  if (Array.isArray(node))
    return node.map((child) => find<T>(child, type)).find(Boolean);
  if (!isValidElement<T & { children?: ReactNode }>(node)) return;
  return node.type === type ? node.props : find<T>(node.props.children, type);
}
function render(approved?: ReportQuery) {
  authHooks.stateCursor = authHooks.effectCursor = 0;
  const tree = ReportSearchForm({ query: approved });
  return {
    tree,
    select: find<ComponentProps<"select">>(tree, "select")!,
    input: find<ComponentProps<typeof TextInput>>(tree, TextInput)!,
  };
}
beforeEach(resetAuthHooks);
it("retains the empty lookup defaults and native GET submission", () => {
  const { tree, select, input } = render();
  expect(tree.props).toMatchObject({ action: REPORT_ROUTE, method: "get" });
  expect(select).toMatchObject({ name: "kind", value: "conversionId" });
  expect(input).toMatchObject({ name: "reference", value: "" });
});
it.each(referenceKinds)("initializes an approved %s lookup", (kind) => {
  const { select, input } = render({ ...query, kind });
  expect(select.value).toBe(kind);
  expect(input.value).toBe(query.reference);
});
it("follows changed approved values only while the form is pristine", () => {
  render(query);
  const next = { ...query, kind: "bookId" as const, reference: "book-2" };
  expect(render(next).select.value).toBe("bookId");
  expect(render(next).input.value).toBe("book-2");
});
it("preserves an active draft when approved query props update", () => {
  render(query).input.onChange("operation-draft");
  const next = { ...query, kind: "bookId" as const, reference: "book-2" };
  expect(render(next).select.value).toBe("operationId");
  expect(render(next).input.value).toBe("operation-draft");
});
it("merges kind and reference changes made before the next render", () => {
  const { select, input } = render(query);
  select.onChange?.({ target: { value: "failureId" } } as Parameters<
    NonNullable<ComponentProps<"select">["onChange"]>
  >[0]);
  input.onChange("failure-draft");
  expect(render(query).select.value).toBe("failureId");
  expect(render(query).input.value).toBe("failure-draft");
});
it("preserves an explicitly cleared draft instead of restoring the URL reference", () => {
  render(query).input.onChange("");
  expect(render({ ...query }).input.value).toBe("");
});
it("initializes from the new approved query after the existing identity/navigation remount", () => {
  render(query).input.onChange("operation-draft");
  resetAuthHooks();
  const next = { ...query, kind: "bookId" as const, reference: "book-2" };
  expect(render(next).select.value).toBe("bookId");
  expect(render(next).input.value).toBe("book-2");
});
