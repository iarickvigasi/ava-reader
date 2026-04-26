import { SectionLabel } from "../section-label";
import { SelectField, StackedField } from "./preferences-fields";
import { SpeakerLargeIcon, SpeakerSmallIcon } from "./preferences-icons";

export function ListeningSection() {
  return (
    <section className="space-y-6">
      <SectionLabel>Listening</SectionLabel>
      <StackedField label="Choose a voice">
        <SelectField value="The Curator (Oxford Female)" />
      </StackedField>
      <StackedField label="Choose ambient">
        <SelectField value="Mirrorpunk — Endless Horizons" />
      </StackedField>
      <StackedField label="Narrator speed">
        <NarratorSpeedSlider value="1.0x" position={50} />
      </StackedField>
    </section>
  );
}

function NarratorSpeedSlider({
  position,
  value,
}: {
  position: number;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <SpeakerSmallIcon className="size-3.5 shrink-0 text-title/70" />
      <div className="relative h-0.5 flex-1 rounded-full bg-line/45">
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-title bg-paper"
          style={{ left: `${position}%` }}
        />
      </div>
      <span className="font-(--font-ui) text-[0.65rem] text-title">
        {value}
      </span>
      <SpeakerLargeIcon className="size-4 shrink-0 text-title/70" />
    </div>
  );
}
