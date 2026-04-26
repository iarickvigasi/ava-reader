import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { AiChat } from "./ai-chats-data";
import {
  RowActionsMenu,
  RowActionsMenuTrigger,
} from "./ai-chats-fields";

type AiChatRowProps = {
  chat: AiChat;
  isMenuOpen: boolean;
  onMenuClose: () => void;
  onMenuToggle: () => void;
};

export function AiChatRow({
  chat,
  isMenuOpen,
  onMenuClose,
  onMenuToggle,
}: AiChatRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        rowRef.current &&
        !rowRef.current.contains(event.target as Node)
      ) {
        onMenuClose();
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isMenuOpen, onMenuClose]);

  return (
    <div
      ref={rowRef}
      className={cn(
        "group/ai-chat-row relative flex items-center justify-between gap-2 rounded-[10px] px-3 py-2 transition",
        isMenuOpen ? "bg-soft-tone-fill/60" : "hover:bg-soft-tone-fill/45",
      )}
    >
      <button
        type="button"
        className="flex-1 truncate text-left font-(--font-display) text-[1.15rem] leading-tight text-title"
      >
        {chat.title}
      </button>
      <RowActionsMenuTrigger
        ariaLabel={`More options for ${chat.title}`}
        isOpen={isMenuOpen}
        onToggle={onMenuToggle}
      />
      {isMenuOpen ? <RowActionsMenu /> : null}
    </div>
  );
}
