"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import {
  REPORT_ROUTE,
  referenceKinds,
} from "@/features/admin/pdf-reports/query";

const labels = [
  "Investigation reference",
  "Operation ID",
  "Failure reference",
  "Book ID",
  "Library item ID",
];
export function ReportSearchForm() {
  const [reference, setReference] = useState("");
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
        value={reference}
        onChange={setReference}
        required
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="submit">Find report</Button>
    </form>
  );
}
