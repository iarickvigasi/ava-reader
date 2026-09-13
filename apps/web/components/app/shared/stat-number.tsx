import { useFormatter, useTranslations } from "next-intl";

export function StatNumber({ value }: { value: number }) {
  const format = useFormatter();
  const t = useTranslations("common.compactNumber");
  const fullValue = format.number(value);
  const magnitude = Math.abs(value);
  const unit = magnitude >= 1_000_000
    ? { key: "million", divisor: 1_000_000 } as const
    : magnitude >= 1_000
      ? { key: "thousand", divisor: 1_000 } as const
      : null;

  // Truncate before formatting so a total never displays a milestone early.
  const wholeValue = format.number(Math.trunc(value / (unit?.divisor ?? 1)), {
    maximumFractionDigits: 0,
  });
  const displayValue = unit ? t(unit.key, { value: wholeValue }) : wholeValue;

  return (
    <span className="whitespace-nowrap" title={fullValue}>
      <span aria-hidden="true">{displayValue}</span>
      <span className="sr-only">{fullValue}</span>
    </span>
  );
}
