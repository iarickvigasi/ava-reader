import { SearchField } from "./highlights-fields";

type ControlsSectionProps = {
  onChange: (value: string) => void;
  value: string;
};

export function ControlsSection({ onChange, value }: ControlsSectionProps) {
  return (
    <section>
      <SearchField onChange={onChange} value={value} />
    </section>
  );
}
