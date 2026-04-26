import { AiChatRow } from "./ai-chat-row";
import type { AiChatGroup as AiChatGroupType } from "./ai-chats-data";

type AiChatGroupProps = {
  group: AiChatGroupType;
  onMenuClose: () => void;
  onMenuToggle: (chatId: string) => void;
  openMenuChatId: string | null;
};

export function AiChatGroup({
  group,
  onMenuClose,
  onMenuToggle,
  openMenuChatId,
}: AiChatGroupProps) {
  return (
    <section className="space-y-2">
      <p className="px-2 font-(--font-ui) text-[0.62rem] uppercase tracking-[0.18em] text-ink/60">
        {group.label}
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
