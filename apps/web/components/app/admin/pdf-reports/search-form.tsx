"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import {
  REPORT_ROUTE,
  referenceKinds,
  type ReportQuery,
} from "@/features/admin/pdf-reports/query";

const labels = [
  "Investigation reference",
  "Operation ID",
  "Failure reference",
  "Book ID",
  "Library item ID",
];
type LookupValues = Pick<ReportQuery, "kind" | "reference">;
export function ReportSearchForm({ query }: { query?: ReportQuery }) {
  const approved: LookupValues = {
    kind: query?.kind ?? referenceKinds[0],
    reference: query?.reference ?? "",
  };
  const [draft, setDraft] = useState<LookupValues>();
  const values = draft ?? approved;
  return (
    <form
      action={REPORT_ROUTE}
      method="get"
      className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
    >
      <label className="grid gap-2 text-sm">
        Reference type
        <select
          name="kind"
          value={values.kind}
          onChange={(event) => {
            const kind = event.target.value as ReportQuery["kind"];
            setDraft((previous) => ({ ...(previous ?? approved), kind }));
          }}
          className="min-h-13 rounded-control bg-paper px-4 text-copy-strong focus-visible:ring-2 focus-visible:ring-line-strong"
        >
          {referenceKinds.map((kind, i) => (
            <option key={kind} value={kind}>
              {labels[i]}
            </option>
          ))}
        </select>
      </label>
      <TextInput
        label="Reference"
        name="reference"
        value={values.reference}
        onChange={(reference) =>
          setDraft((previous) => ({ ...(previous ?? approved), reference }))
        }
        required
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="submit">Find report</Button>
    </form>
  );
}
