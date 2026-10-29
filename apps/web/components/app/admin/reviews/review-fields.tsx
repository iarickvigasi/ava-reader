"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useReviewFields } from "@/features/admin/reviews/use-review-fields";
import { TextInput } from "@/components/ui/text-input";
import type { ReadingReview } from "@/lib/api-types/reading-review";

export function ReviewFields({ entry }: { entry: ReadingReview }) {
  const fields = useReviewFields(entry.review);
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <TextInput
          key={field.name}
          {...field}
          inputClassName="placeholder:text-sm"
          required
          pattern={field.type === "url" ? "https://.*" : undefined}
        />
      ))}
      <label className="flex cursor-pointer items-start gap-3 leading-7">
        <Checkbox name="rightsConfirmed" required />
        <span>I checked permission to distribute this exact edition.</span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 leading-7">
        <Checkbox name="qualityConfirmed" required />
        <span>
          I previewed the text and checked its quality and completeness.
        </span>
      </label>
    </fieldset>
  );
}
