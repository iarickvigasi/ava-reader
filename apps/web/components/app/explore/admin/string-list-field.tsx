export function StringListField({
  label,
  values,
  change,
}: {
  label: string;
  values: string[];
  change: (values: string[]) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-muted">{label} (one per line)</span>
      <textarea
        className="min-h-24 w-full rounded-control bg-surface p-3"
        value={values.join("\n")}
        onChange={(event) => change(event.target.value.split("\n"))}
      />
    </label>
  );
}
