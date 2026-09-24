import { useLocale } from "next-intl";
import type { HomePayload } from "@/lib/api-types/home";
import type { useMasteryHistory } from "./use-mastery-history";
import { useMasteryScroll } from "./use-mastery-scroll";

export function useMasteryChart(
  mastery: HomePayload["mastery"],
  history: ReturnType<typeof useMasteryHistory>,
) {
  const locale = useLocale();
  const days = [...history.days, ...mastery.days];
  const scroll = useMasteryScroll(
    days.length,
    history.hasMore,
    history.load,
    history.status === "idle",
  );
  const firstDate = Date.parse(`${days[0].key}T00:00:00Z`);
  const placeholderDays = Array.from({ length: 7 }, (_, index) =>
    new Date(firstDate - (7 - index) * 86_400_000).toISOString().slice(0, 10),
  );
  const dateKeys = [
    ...(history.hasMore ? placeholderDays : []),
    ...days.map((day) => day.key),
  ];
  const last = Math.max(6, dateKeys.length - 1 - Math.round(scroll.offset));
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const dateLabel = (key: string) =>
    formatter.format(new Date(`${key}T00:00:00Z`));
  return {
    ...scroll,
    days,
    placeholderDays,
    todayKey: mastery.days.at(-1)?.key,
    range: `${dateLabel(dateKeys[last - 6])} – ${dateLabel(dateKeys[last])}`,
    atStart: !history.hasMore && scroll.offset >= days.length - 7,
    atToday: scroll.offset < 0.01,
    todayVisible: scroll.offset < 1,
  };
}
