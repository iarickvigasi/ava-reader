import { useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { RowActionsMenu } from "../row-actions-menu";
import { RowActionsMenuTrigger } from "../row-actions-menu-trigger";
import { useDismissOnOutsideClick } from "../use-dismiss-on-outside-click";
import type { AiChat } from "./ai-chats-data";

type AiChatRowProps = {
  chat: AiChat;
  isMenuOpen: boolean;
  onMenuClose: () => void;
  onMenuToggle: () => void;
  onDelete?: () => void;
  onRename?: () => void;
};

export function AiChatRow({
  chat,
  isMenuOpen,
  onMenuClose,
  onMenuToggle,
  onDelete,
  onRename,
}: AiChatRowProps) {
  const t = useTranslations("reader.aiChats");
  const rowRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(rowRef, isMenuOpen, onMenuClose);

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
        group="ai-chat-row"
        isOpen={isMenuOpen}
        onToggle={onMenuToggle}
        sizeClass="size-7"
      />
      {isMenuOpen ? (
        <RowActionsMenu
          actions={[
            { kind: "rename", label: t("rename"), onClick: onRename },
            { kind: "delete", label: t("delete"), onClick: onDelete },
          ]}
        />
      ) : null}
    </div>
  );
}
