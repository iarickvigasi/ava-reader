import { useLocale, useTranslations } from "next-intl";
import { AiChatRow } from "./ai-chat-row";
import type { AiChatGroup as AiChatGroupType } from "./ai-chats-data";

type AiChatGroupProps = {
  group: AiChatGroupType;
  onMenuClose: () => void;
  onMenuToggle: (chatId: string) => void;
  openMenuChatId: string | null;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Group ids are stable discriminators: "today" / "yesterday" map to known
// labels we ship per locale, ISO dates (YYYY-MM-DD) are formatted with the
// user's locale, and anything else falls back to the server-supplied label.
function resolveGroupLabel(
  group: AiChatGroupType,
  t: (key: string) => string,
  locale: string,
): string {
  if (group.id === "today") return t("today");
  if (group.id === "yesterday") return t("yesterday");
  if (ISO_DATE_PATTERN.test(group.id)) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${group.id}T00:00:00`));
  }
  return group.label ?? group.id;
}

export function AiChatGroup({
  group,
  onMenuClose,
  onMenuToggle,
  openMenuChatId,
}: AiChatGroupProps) {
  const t = useTranslations("reader.aiChats.groups");
  const locale = useLocale();
  const label = resolveGroupLabel(group, t, locale);

  return (
    <section className="space-y-2">
      <p className="px-2 font-(--font-ui) text-[0.62rem] uppercase tracking-[0.18em] text-ink/60">
        {label}
      </p>
      <ul className="space-y-1">
        {group.chats.map((chat) => (
          <li key={chat.id}>
            <AiChatRow
              chat={chat}
              isMenuOpen={openMenuChatId === chat.id}
              onMenuClose={onMenuClose}
              onMenuToggle={() => onMenuToggle(chat.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
