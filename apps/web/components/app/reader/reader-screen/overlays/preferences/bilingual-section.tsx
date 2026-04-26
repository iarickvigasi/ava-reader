import { FieldRow, NumberField, SelectField } from "./preferences-fields";

export function BilingualSection() {
  return (
    <section className="space-y-6">
      <FieldRow label="Translate to">
        <SelectField value="French" />
      </FieldRow>
      <FieldRow
        label={
          <>
            Reading goal
            <br />
            (min/day)
          </>
        }
      >
        <NumberField value="60" />
      </FieldRow>
    </section>
  );
}
