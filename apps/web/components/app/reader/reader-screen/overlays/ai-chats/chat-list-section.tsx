import { useState } from "react";
import { AiChatGroup } from "./ai-chat-group";
import type { AiChatGroup as AiChatGroupType } from "./ai-chats-data";

type ChatListSectionProps = {
  groups: AiChatGroupType[];
};

export function ChatListSection({ groups }: ChatListSectionProps) {
  const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);

  return (
    <nav
      className="min-h-0 flex-1 space-y-6 overflow-auto pb-8 pr-2"
      onClick={(event) => {
        // Clicking the empty list region closes any open row menu.
        if (event.target === event.currentTarget) {
          setOpenMenuChatId(null);
        }
      }}
    >
      {groups.map((group) => (
        <AiChatGroup
          key={group.id}
          group={group}
          openMenuChatId={openMenuChatId}
          onMenuToggle={(chatId) =>
            setOpenMenuChatId((current) => (current === chatId ? null : chatId))
          }
          onMenuClose={() => setOpenMenuChatId(null)}
        />
      ))}
    </nav>
  );
}
