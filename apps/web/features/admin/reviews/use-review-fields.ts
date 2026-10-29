"use client";
import { useState } from "react";
import type { ReadingReview } from "@/lib/api-types/reading-review";

const definitions = [
  {
    name: "rightsStatement",
    label: "Rights basis",
    placeholder: "This edition, translation, and illustrations",
    type: "text",
  },
  {
    name: "rightsUrl",
    label: "Rights evidence URL",
    placeholder: "https://…",
    type: "url",
  },
  {
    name: "rightsJurisdiction",
    label: "Reviewed territories",
    placeholder: "Territories covered by this review",
    type: "text",
  },
  {
    name: "notes",
    label: "Quality and completeness notes",
    placeholder: "Text samples, volumes, and known defects",
    type: "text",
  },
] as const;
export function useReviewFields(review: ReadingReview["review"]) {
  const [values, setValues] = useState<Record<string, string>>(review ?? {});
  return definitions.map((field) => ({
    ...field,
    value: values[field.name] ?? "",
    onChange: (value: string) =>
      setValues((current) => ({ ...current, [field.name]: value })),
  }));
}
