import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MAX_READING_GOAL_MINUTES,
  MIN_READING_GOAL_MINUTES,
  parseReadingGoal,
} from "@/components/app/preferences/reading-goal";
import { NumberField } from "./preferences-fields";

type GoalDraft = {
  text: string;
  sourceValue: number;
  focused: boolean;
  invalid: boolean;
};

export function ReadingGoalField({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const t = useTranslations("preferences.readingGoal");
  const errorId = useId();
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  // A delayed preferences read must not replace an edit in progress. Once
  // focus leaves the input, a new saved value supersedes an older invalid draft.
  const activeDraft = draft?.focused || draft?.sourceValue === value ? draft : null;

  function commit(raw: string) {
    const next = parseReadingGoal(raw);
    if (next === null) {
      setDraft({ text: raw, sourceValue: value, focused: false, invalid: true });
      return;
    }
    setDraft(null);
    if (next !== value) onChange(next);
  }

  return (
    <div className="space-y-2">
      <NumberField
        aria-label={t("ariaLabel")}
        aria-describedby={activeDraft?.invalid ? errorId : undefined}
        aria-invalid={activeDraft?.invalid || undefined}
        name="readingGoalMinutes"
        min={MIN_READING_GOAL_MINUTES}
        max={MAX_READING_GOAL_MINUTES}
        step={1}
        value={activeDraft?.text ?? String(value)}
        onFocus={() => {
          if (activeDraft) {
            setDraft({ ...activeDraft, sourceValue: value, focused: true });
          }
        }}
        onChange={(event) => setDraft({
          text: event.currentTarget.value,
          sourceValue: value,
          focused: true,
          invalid: false,
        })}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
          }
        }}
      />
      {activeDraft?.invalid && (
        <p id={errorId} role="alert" className="font-ui text-sm text-danger">
          {t("invalid", {
            min: MIN_READING_GOAL_MINUTES,
            max: MAX_READING_GOAL_MINUTES,
          })}
        </p>
      )}
    </div>
  );
}
